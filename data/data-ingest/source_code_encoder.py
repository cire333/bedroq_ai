import os, uuid, time, random, hashlib, mimetypes, re
from typing import List, Dict, Optional, Any, Tuple
import psycopg2, psycopg2.extras
from psycopg2.extras import Json
from pgvector.psycopg2 import register_vector
from openai import OpenAI, RateLimitError

# 1536-D for code (fast + cheap)
CODE_EMBED_MODEL = "text-embedding-3-small"
CODE_EMBED_DIMS  = 1536

# ---------- schema bootstrapping (code side) ----------
def ensure_code_schema(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        cur.execute("""
        CREATE TABLE IF NOT EXISTS code_repos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          provider TEXT,          -- e.g., github, gitlab, local
          uri TEXT,               -- https://... or file:///...
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

        cur.execute("""
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

        # Optional symbol table (left empty by this function; fill later if you parse symbols)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS code_symbols (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_id UUID REFERENCES code_files(id),
          kind TEXT, name TEXT, signature TEXT,
          line_start INT, line_end INT,
          extras JSONB
        );""")

        # Link commit ↔ schematic version (binds code snapshot to a HW snapshot)
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

        # ANN index for code chunks (cosine / halfvec)
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

# ---------- helpers ----------
def pg_connect():
    url = os.getenv("DATABASE_URL")
    conn = psycopg2.connect(url) if url else psycopg2.connect(
        host=os.getenv("PGHOST","localhost"),
        port=int(os.getenv("PGPORT","5432")),
        user=os.getenv("PGUSER","postgres"),
        password=os.getenv("PGPASSWORD",""),
        dbname=os.getenv("PGDATABASE","postgres"),
    )
    conn.autocommit = True
    psycopg2.extras.register_uuid(conn_or_curs=conn)
    register_vector(conn)
    return conn

def get_openai_client() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set")
    return OpenAI(api_key=key)

def stable_hash_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8", errors="ignore")).hexdigest()

EXT_LANG = {
    ".c":"c", ".h":"c", ".cpp":"cpp", ".hpp":"cpp",
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
    # treat common binaries as non-text
    return not re.search(rb'\.(png|jpg|jpeg|gif|pdf|zip|bin|hex|elf)\b', path.encode("utf-8"), re.I)

def chunk_text(s: str, max_chars: int = 4000, overlap: int = 400) -> List[str]:
    if len(s) <= max_chars: return [s]
    chunks = []
    i = 0
    while i < len(s):
        chunk = s[i:i+max_chars]
        chunks.append(chunk)
        i += max_chars - overlap
    return chunks

def embed_batch(client: OpenAI, texts: List[str], model=CODE_EMBED_MODEL, max_retries=6) -> List[List[float]]:
    if not texts: return []
    delay = 0.6
    for attempt in range(max_retries):
        try:
            resp = client.embeddings.create(model=model, input=texts)
            return [list(item.embedding) for item in resp.data]
        except RateLimitError:
            time.sleep(delay * (2**attempt) + random.uniform(0,0.4))
    raise RuntimeError("OpenAI embeddings rate-limited after retries")

# ---------- core: ingest a code snapshot and bind to a schematic version ----------
def ingest_code_snapshot(
    conn,
    *,
    project_id: uuid.UUID,
    schematic_version_id: uuid.UUID,
    repo_uri: str,
    provider: str = "github",
    branch_name: str = "main",
    commit_sha: Optional[str] = None,
    committed_at: Optional[str] = None,   # ISO8601 or None
    author: Optional[str] = None,
    message: Optional[str] = None,
    files: List[Tuple[str, bytes]] = [],  # list of (path, bytes_content)
    embed_batch_size: int = 32,
) -> Dict[str, Any]:
    """
    Ingest a set of source files for a single commit and link it to a schematic version.

    files: list of (path, bytes). Binary files are skipped. Large text files are chunked (4k chars, 400 overlap).
    Returns dict with repo_id, commit_id, counts.
    """
    ensure_code_schema(conn)
    client = get_openai_client()

    with conn.cursor() as cur:
        # 1) repo
        cur.execute("""
            INSERT INTO code_repos (project_id, provider, uri, default_branch)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (project_id, uri) DO UPDATE
            SET provider = EXCLUDED.provider,
                default_branch = COALESCE(code_repos.default_branch, EXCLUDED.default_branch)
            RETURNING id;""",
            (project_id, provider, repo_uri, branch_name))
        repo_id = cur.fetchone()[0]

        # 2) commit row
        if not commit_sha:
            # derive a synthetic commit id from content (order-insensitive)
            h = hashlib.sha256()
            for p, b in sorted(files, key=lambda t: t[0]):
                h.update(p.encode("utf-8"))
                h.update(b)
            commit_sha = h.hexdigest()[:40]

        cur.execute("""
            INSERT INTO code_commits (repo_id, commit_sha, branch_name, committed_at, author, message)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (repo_id, commit_sha) DO UPDATE
            SET branch_name = EXCLUDED.branch_name,
                committed_at = COALESCE(code_commits.committed_at, EXCLUDED.committed_at),
                author = COALESCE(code_commits.author, EXCLUDED.author),
                message = COALESCE(code_commits.message, EXCLUDED.message)
            RETURNING id;""",
            (repo_id, commit_sha, branch_name, committed_at, author, message))
        commit_id = cur.fetchone()[0]

        # 3) files + chunks
        inserted_files = 0
        inserted_chunks = 0

        for path, content in files:
            if not is_probably_text(path, content):
                continue
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                # best-effort fallback
                text = content.decode("latin-1", errors="ignore")

            lang = guess_lang(path)
            c_hash = stable_hash_text(text)
            size = len(content)

            # upsert file
            cur.execute("""
                INSERT INTO code_files (commit_id, path, lang, size_bytes, content_hash, text)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (commit_id, path) DO UPDATE
                SET lang = EXCLUDED.lang,
                    size_bytes = EXCLUDED.size_bytes,
                    content_hash = EXCLUDED.content_hash,
                    text = EXCLUDED.text
                RETURNING id;""",
                (commit_id, path, lang, size, c_hash, text))
            file_id = cur.fetchone()[0]
            inserted_files += 1

            # chunk + embed
            chunks = chunk_text(text, max_chars=4000, overlap=400)
            # remove old chunks if re-ingesting
            cur.execute("DELETE FROM code_chunks WHERE file_id = %s;", (file_id,))

            for i in range(0, len(chunks), embed_batch_size):
                batch = chunks[i:i+embed_batch_size]
                embs = embed_batch(client, [f"{path}\n{t}" for t in batch])  # include path for light context
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
                inserted_chunks += len(rows)

        # 4) bind commit ↔ schematic version
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
        "files_ingested": inserted_files,
        "chunks_embedded": inserted_chunks,
        "schematic_version_id": str(schematic_version_id),
    }

# ---------- convenience: ingest a directory on disk ----------
def load_dir_as_files(root_dir: str, include_globs: Optional[List[str]] = None, exclude_globs: Optional[List[str]] = None) -> List[Tuple[str, bytes]]:
    import fnmatch
    files = []
    for base, _, names in os.walk(root_dir):
        for n in names:
            rel = os.path.relpath(os.path.join(base, n), root_dir)
            if exclude_globs and any(fnmatch.fnmatch(rel, g) for g in exclude_globs):
                continue
            if include_globs and not any(fnmatch.fnmatch(rel, g) for g in include_globs):
                continue
            with open(os.path.join(root_dir, rel), "rb") as f:
                files.append((rel.replace("\\","/"), f.read()))
    return files
