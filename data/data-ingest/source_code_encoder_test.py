#!/usr/bin/env python3
import os, sys, uuid, argparse, hashlib, mimetypes, re, time, random, json
from typing import List, Tuple, Dict, Any, Optional

import psycopg2, psycopg2.extras
from psycopg2.extras import Json
from pgvector.psycopg2 import register_vector

# OpenAI >= 1.0
from openai import OpenAI, RateLimitError

# -----------------------------
# Embedding model (code side)
# -----------------------------
CODE_EMBED_MODEL = "text-embedding-3-small"
CODE_EMBED_DIMS  = 1536

# -----------------------------
# DB helpers
# -----------------------------
def pg_connect():
    db_url = os.getenv("DATABASE_URL")
    conn = psycopg2.connect(db_url) if db_url else psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", ""),
        dbname=os.getenv("PGDATABASE", "postgres"),
    )
    conn.autocommit = True
    psycopg2.extras.register_uuid(conn_or_curs=conn)
    register_vector(conn)
    return conn

def ensure_code_schema(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS schematic_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          version_tag TEXT,
          content_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          metadata JSONB
        );""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS code_repos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          provider TEXT,
          uri TEXT,
          default_branch TEXT,
          UNIQUE(project_id, uri)
        );""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS code_commits (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          repo_id UUID REFERENCES code_repos(id),
          commit_sha TEXT NOT NULL,
          branch_name TEXT,
          committed_at TIMESTAMPTZ,
          author TEXT,
          message TEXT,
          UNIQUE(repo_id, commit_sha)
        );""")
        cur.execute(f"""
        CREATE TABLE IF NOT EXISTS code_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          commit_id UUID REFERENCES code_commits(id),
          path TEXT,
          lang TEXT,
          size_bytes BIGINT,
          content_hash TEXT,
          text TEXT,
          UNIQUE(commit_id, path)
        );""")
        cur.execute(f"""
        CREATE TABLE IF NOT EXISTS code_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_id UUID REFERENCES code_files(id),
          chunk_index INT,
          text TEXT,
          embedding VECTOR({CODE_EMBED_DIMS}),
          UNIQUE(file_id, chunk_index)
        );""")
        cur.execute("""
        CREATE TABLE IF NOT EXISTS schematic_code_bindings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          schematic_version_id UUID REFERENCES schematic_versions(id),
          repo_id UUID REFERENCES code_repos(id),
          commit_id UUID REFERENCES code_commits(id),
          branch_name TEXT,
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE (schematic_version_id, commit_id)
        );""")
        cur.execute("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'code_chunks_hnsw_halfvec_cos') THEN
            CREATE INDEX code_chunks_hnsw_halfvec_cos
            ON code_chunks
            USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops);
          END IF;
        END$$;""")
        cur.execute("ANALYZE;")

# -----------------------------
# OpenAI helpers
# -----------------------------
def get_openai_client() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set")
    return OpenAI(api_key=key)

def embed_batch(client: OpenAI, texts: List[str], model=CODE_EMBED_MODEL, max_retries=6) -> List[List[float]]:
    if not texts: return []
    delay = 0.6
    for attempt in range(max_retries):
        try:
            resp = client.embeddings.create(model=model, input=texts)
            return [list(item.embedding) for item in resp.data]
        except RateLimitError:
            time.sleep(delay * (2**attempt) + random.uniform(0, 0.4))
    raise RuntimeError("OpenAI embeddings rate-limited after retries")

# -----------------------------
# File processing helpers
# -----------------------------
EXT_LANG = {
    ".c":"c", ".h":"c", ".cpp":"cpp", ".hpp":"cpp", ".cc":"cpp",
    ".ino":"arduino", ".rs":"rust", ".py":"python",
    ".S":"asm", ".s":"asm", ".ld":"ld",
    ".dts":"dts", ".dtsi":"dts", ".yaml":"yaml", ".yml":"yaml",
    ".json":"json", ".txt":"text", ".md":"markdown",
}

def guess_lang(path: str) -> str:
    ext = (os.path.splitext(path)[1] or "").lower()
    return EXT_LANG.get(ext) or (mimetypes.guess_type(path)[0] or "text")

def is_probably_text(path: str, content: bytes) -> bool:
    if b"\x00" in content[:4096]:
        return False
    return not re.search(rb'\.(png|jpg|jpeg|gif|pdf|zip|bin|hex|elf)\b', path.encode("utf-8"), re.I)

def stable_hash_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8", errors="ignore")).hexdigest()

def chunk_text(s: str, max_chars: int = 4000, overlap: int = 400) -> List[str]:
    if len(s) <= max_chars: return [s]
    chunks, i = [], 0
    while i < len(s):
        chunks.append(s[i:i+max_chars])
        i += max_chars - overlap
    return chunks

def load_dir_as_files(root_dir: str, include_globs: Optional[List[str]] = None, exclude_globs: Optional[List[str]] = None) -> List[Tuple[str, bytes]]:
    import fnmatch
    files: List[Tuple[str, bytes]] = []
    for base, _, names in os.walk(root_dir):
        for n in names:
            rel = os.path.relpath(os.path.join(base, n), root_dir)
            rel_posix = rel.replace("\\", "/")
            if exclude_globs and any(fnmatch.fnmatch(rel_posix, g) for g in exclude_globs):
                continue
            if include_globs and not any(fnmatch.fnmatch(rel_posix, g) for g in include_globs):
                continue
            with open(os.path.join(root_dir, rel), "rb") as f:
                files.append((rel_posix, f.read()))
    return files

# -----------------------------
# Core: ingest commit snapshot
# -----------------------------
def ingest_code_snapshot(
    conn,
    *,
    project_id: uuid.UUID,
    schematic_version_id: uuid.UUID,
    repo_uri: str,
    provider: str = "github",
    branch_name: str = "main",
    commit_sha: Optional[str] = None,
    committed_at: Optional[str] = None,
    author: Optional[str] = None,
    message: Optional[str] = None,
    files: List[Tuple[str, bytes]] = [],
    embed_batch_size: int = 32,
) -> Dict[str, Any]:
    ensure_code_schema(conn)
    client = get_openai_client()

    with conn.cursor() as cur:
        # repo
        cur.execute("""
            INSERT INTO code_repos (project_id, provider, uri, default_branch)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (project_id, uri) DO UPDATE
            SET provider = EXCLUDED.provider,
                default_branch = COALESCE(code_repos.default_branch, EXCLUDED.default_branch)
            RETURNING id;
        """, (project_id, provider, repo_uri, branch_name))
        repo_id = cur.fetchone()[0]

        # commit (synthesize SHA from content if not provided)
        if not commit_sha:
            h = hashlib.sha256()
            for p, b in sorted(files, key=lambda t: t[0]):
                h.update(p.encode("utf-8")); h.update(b)
            commit_sha = h.hexdigest()[:40]

        cur.execute("""
            INSERT INTO code_commits (repo_id, commit_sha, branch_name, committed_at, author, message)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (repo_id, commit_sha) DO UPDATE
            SET branch_name = EXCLUDED.branch_name,
                committed_at = COALESCE(code_commits.committed_at, EXCLUDED.committed_at),
                author = COALESCE(code_commits.author, EXCLUDED.author),
                message = COALESCE(code_commits.message, EXCLUDED.message)
            RETURNING id;
        """, (repo_id, commit_sha, branch_name, committed_at, author, message))
        commit_id = cur.fetchone()[0]

        # files + chunks
        files_ingested = 0
        chunks_embedded = 0

        for path, content in files:
            if not is_probably_text(path, content):
                continue
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                text = content.decode("latin-1", errors="ignore")

            lang = guess_lang(path)
            c_hash = stable_hash_text(text)
            size = len(content)

            cur.execute("""
                INSERT INTO code_files (commit_id, path, lang, size_bytes, content_hash, text)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (commit_id, path) DO UPDATE
                SET lang = EXCLUDED.lang,
                    size_bytes = EXCLUDED.size_bytes,
                    content_hash = EXCLUDED.content_hash,
                    text = EXCLUDED.text
                RETURNING id;
            """, (commit_id, path, lang, size, c_hash, text))
            file_id = cur.fetchone()[0]
            files_ingested += 1

            # clear existing chunks (re-ingest safe)
            cur.execute("DELETE FROM code_chunks WHERE file_id = %s;", (file_id,))
            chunks = chunk_text(text, max_chars=4000, overlap=400)

            for i in range(0, len(chunks), embed_batch_size):
                batch = chunks[i:i+embed_batch_size]
                # include path for light context
                embs = embed_batch(client, [f"{path}\n{t}" for t in batch], model=CODE_EMBED_MODEL)
                rows = [{
                    "id": uuid.uuid4(),
                    "file_id": file_id,
                    "chunk_index": i + j,
                    "text": batch[j],
                    "embedding": embs[j],
                } for j in range(len(batch))]
                psycopg2.extras.execute_batch(cur, """
                    INSERT INTO code_chunks (id, file_id, chunk_index, text, embedding)
                    VALUES (%(id)s, %(file_id)s, %(chunk_index)s, %(text)s, %(embedding)s)
                """, rows)
                chunks_embedded += len(rows)

        # bind commit to schematic version
        cur.execute("""
            INSERT INTO schematic_code_bindings (project_id, schematic_version_id, repo_id, commit_id, branch_name)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (schematic_version_id, commit_id) DO NOTHING;
        """, (project_id, schematic_version_id, repo_id, commit_id, branch_name))

    return {
        "repo_id": str(repo_id),
        "commit_id": str(commit_id),
        "commit_sha": commit_sha,
        "branch_name": branch_name,
        "files_ingested": files_ingested,
        "chunks_embedded": chunks_embedded,
        "schematic_version_id": str(schematic_version_id),
    }

# -----------------------------
# CLI wrapper = your snippet
# -----------------------------
def main():
    ap = argparse.ArgumentParser(description="Ingest a code snapshot and bind to a schematic version.")
    ap.add_argument("--project-id", required=True, help="UUID of existing projects.id")
    ap.add_argument("--schematic-version-id", required=True, help="UUID of existing schematic_versions.id")
    ap.add_argument("--repo-dir", required=True, help="Path to local repo directory")
    ap.add_argument("--repo-uri", required=True, help="Repo URI (e.g., https://github.com/acme/firmware)")
    ap.add_argument("--provider", default="github")
    ap.add_argument("--branch", default="feature/camera-led")
    ap.add_argument("--commit-sha", default=None)
    ap.add_argument("--committed-at", default=None, help="ISO8601 timestamp (optional)")
    ap.add_argument("--author", default="Jane Dev <jane@example.com>")
    ap.add_argument("--message", default="Initial bringup")
    ap.add_argument("--embed-batch-size", type=int, default=32)
    args = ap.parse_args()

    conn = pg_connect()

    project_id = uuid.UUID(args.project_id)
    schematic_version_id = uuid.UUID(args.schematic_version_id)

    files = load_dir_as_files(
        root_dir=args.repo_dir,
        include_globs=["**/*.c", "**/*.h", "**/*.cpp", "**/*.hpp", "**/*.dts", "**/*.py", "**/*.md"],
        exclude_globs=["**/.git/**", "**/build/**", "**/*.png", "**/*.pdf"]
    )

    summary = ingest_code_snapshot(
        conn,
        project_id=project_id,
        schematic_version_id=schematic_version_id,
        repo_uri=args.repo_uri,
        provider=args.provider,
        branch_name=args.branch,
        commit_sha=args.commit_sha,       # None -> synthesize from content
        committed_at=args.committed_at,   # e.g., "2025-09-30T12:34:00Z"
        author=args.author,
        message=args.message,
        files=files,
        embed_batch_size=args.embed_batch_size,
    )

    print(json.dumps(summary, indent=2))

if __name__ == "__main__":
    main()
