"""
This code ingests source code files for a single commit, extracts simple pin-related facts,
and synthesizes pin facts for hybrid search with schematic data.

Notes: It uses OpenAI embeddings and stores data in PostgreSQL with pgvector.
"""
#!/usr/bin/env python3
import os, uuid, time, random, hashlib, mimetypes, re, json
from typing import List, Dict, Optional, Any, Tuple

import psycopg2, psycopg2.extras
from psycopg2.extras import Json
from pgvector.psycopg2 import register_vector
from openai import OpenAI, RateLimitError

# -----------------------------
# Embedding model (code + facts)
# -----------------------------
CODE_EMBED_MODEL = "text-embedding-3-small"
CODE_EMBED_DIMS  = 1536

# ---------- schema bootstrapping (code + facts + minimal HW) ----------
def ensure_code_schema(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # ---- existing code tables ----
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

        cur.execute("""
        CREATE TABLE IF NOT EXISTS code_symbols (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          file_id UUID REFERENCES code_files(id),
          kind TEXT, name TEXT, signature TEXT,
          line_start INT, line_end INT,
          extras JSONB
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

        # ---- NEW: structured SW facts extracted from code ----
        cur.execute("""
        CREATE TABLE IF NOT EXISTS code_pin_refs (
          commit_id UUID REFERENCES code_commits(id),
          file_id   UUID REFERENCES code_files(id),
          symbol    TEXT,
          value_int INT,
          context   TEXT,
          PRIMARY KEY (commit_id, file_id, symbol)
        );""")
        cur.execute("CREATE INDEX IF NOT EXISTS code_pin_refs_commit ON code_pin_refs(commit_id);")

        cur.execute("""
        CREATE TABLE IF NOT EXISTS code_pin_mux_facts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          commit_id UUID REFERENCES code_commits(id),
          file_id   UUID REFERENCES code_files(id),
          component_ref TEXT,       -- optional if you can map it
          pin_name TEXT,            -- e.g. 'PA9'
          af_code TEXT,             -- e.g. 'AF7'
          function TEXT,            -- e.g. 'USART1_TX'
          evidence JSONB
        );""")
        cur.execute("CREATE INDEX IF NOT EXISTS code_pin_mux_commit ON code_pin_mux_facts(commit_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS code_pin_mux_pin ON code_pin_mux_facts(pin_name);")

        # ---- NEW: minimal HW tables used by facts (safe even if HW ingest owns them) ----
        cur.execute("""
        CREATE TABLE IF NOT EXISTS component_pins (
          schematic_version_id UUID REFERENCES schematic_versions(id),
          component_ref TEXT,
          pin_number INT,
          pin_name TEXT,
          bank TEXT,
          PRIMARY KEY (schematic_version_id, component_ref, COALESCE(pin_name, pin_number::text))
        );""")

        cur.execute("""
        CREATE TABLE IF NOT EXISTS pin_connections (
          schematic_version_id UUID REFERENCES schematic_versions(id),
          component_ref TEXT,
          pin_number INT,
          pin_name TEXT,
          net_name TEXT,
          PRIMARY KEY (schematic_version_id, component_ref, COALESCE(pin_name, pin_number::text))
        );""")
        cur.execute("CREATE INDEX IF NOT EXISTS pin_conn_sv_net ON pin_connections(schematic_version_id, net_name);")

        cur.execute("""
        CREATE TABLE IF NOT EXISTS component_models (
          schematic_version_id UUID REFERENCES schematic_versions(id),
          component_ref TEXT,
          mcu_model TEXT,
          PRIMARY KEY (schematic_version_id, component_ref)
        );""")

        cur.execute("""
        CREATE TABLE IF NOT EXISTS mcu_pin_function_catalog (
          mcu_model TEXT,
          pin_name TEXT,
          af_code TEXT,
          function TEXT,
          notes TEXT,
          PRIMARY KEY (mcu_model, pin_name, af_code, function)
        );""")

        # ---- NEW: semantic overlays for hybrid search ----
        cur.execute(f"""
        CREATE TABLE IF NOT EXISTS pin_facts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schematic_version_id UUID REFERENCES schematic_versions(id),
          commit_id UUID REFERENCES code_commits(id),
          component_ref TEXT,
          pin_name TEXT,
          net_name TEXT,
          selected_function TEXT,
          provenance JSONB,
          doc TEXT,
          embedding VECTOR({CODE_EMBED_DIMS})
        );""")

        cur.execute(f"""
        CREATE TABLE IF NOT EXISTS peripheral_facts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schematic_version_id UUID REFERENCES schematic_versions(id),
          commit_id UUID REFERENCES code_commits(id),
          peripheral TEXT,
          summary TEXT,
          embedding VECTOR({CODE_EMBED_DIMS})
        );""")

        # ---- ANN indexes ----
        cur.execute("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'code_chunks_hnsw_halfvec_cos') THEN
            CREATE INDEX code_chunks_hnsw_halfvec_cos
            ON code_chunks
            USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops);
          END IF;
        END$$;""")

        cur.execute("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'pin_facts_hnsw_halfvec_cos') THEN
            CREATE INDEX pin_facts_hnsw_halfvec_cos
            ON pin_facts
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

# ---------- simple extractors (heuristics) ----------
PIN_DEFINE_RE   = re.compile(r'^\s*#\s*define\s+([A-Z0-9_]*?(SERIAL|UART|USART|TX|RX|SCL|SDA)[A-Z0-9_]*)\s+(\d+)\s*$', re.I | re.M)
PIN_CONST_RE    = re.compile(r'\b(const\s+(?:int|uint\d*_t)\s+([A-Za-z0-9_]*?(SERIAL|UART|USART|TX|RX|SCL|SDA)[A-Za-z0-9_]*)\s*=\s*)(\d+)', re.I)
ARDUINO_SET_RE  = re.compile(r'\bSerial\d*\.set(TX|RX)\s*\(\s*(\d+)\s*\)', re.I)

# Zephyr/Devicetree-like: usart1_tx_pa9, i2c1_scl_pb6, spi0_mosi_pa7
DT_PINFUNC_RE   = re.compile(r'\b(uart|usart|spi|i2c)(\d*)_(tx|rx|mosi|miso|sck|scl|sda)_p([a-z])(\d+)\b', re.I)

# STM32 HAL: GPIO_AF7_USART1 or GPIO_AF7_SPI1; keep function, AF when present (pin name may be in same file but not same line)
STM32_AF_RE     = re.compile(r'\bGPIO_AF(\d+)_([A-Z0-9]+)\b')

def extract_code_pin_refs(text: str) -> List[Dict[str, Any]]:
    out = []
    for m in PIN_DEFINE_RE.finditer(text):
        symbol, _, value = m.group(1), m.group(2), m.group(3)
        out.append({"symbol": symbol, "value_int": int(value), "context": "serial/gpio/board", "evidence": {"match": m.group(0)}})
    for m in PIN_CONST_RE.finditer(text):
        symbol = m.group(2)
        val    = m.group(4)
        out.append({"symbol": symbol, "value_int": int(val), "context": "serial/gpio/const", "evidence": {"match": m.group(0)}})
    for m in ARDUINO_SET_RE.finditer(text):
        what, val = m.group(1).lower(), m.group(2)
        ctx = f"serial/{what}"
        out.append({"symbol": f"Serial.set{what.upper()}", "value_int": int(val), "context": ctx, "evidence": {"match": m.group(0)}})
    return out

def extract_code_pin_mux_facts(text: str) -> List[Dict[str, Any]]:
    out = []
    # Devicetree-like explicit pin names (best quality)
    for m in DT_PINFUNC_RE.finditer(text):
        proto = m.group(1).upper()
        idx   = m.group(2) or ""
        role  = m.group(3).upper()
        port  = m.group(4).upper()
        num   = m.group(5)
        pin_name = f"P{port}{num}"
        function = f"{proto}{idx}_{role}"  # e.g., USART1_TX
        out.append({"pin_name": pin_name, "function": function, "af_code": None, "evidence": {"match": m.group(0)}})

    # STM32 HAL AF declarations (no pin on this line; still useful)
    for m in STM32_AF_RE.finditer(text):
        af  = f"AF{m.group(1)}"
        fn  = m.group(2).upper()  # e.g., USART1 / SPI1
        # Often the actual role (TX/RX) is near; keep as-is
        out.append({"pin_name": None, "function": fn, "af_code": af, "evidence": {"match": m.group(0)}})

    return out

# ---------- synthesize & embed pin facts ----------
def synthesize_pin_facts_docs(conn, *, schematic_version_id: uuid.UUID, commit_id: uuid.UUID) -> List[Tuple[str, str, Optional[str], Optional[str], Dict[str, Any], str]]:
    """
    Returns list of tuples to insert into pin_facts:
    (component_ref, pin_name, net_name, selected_function, provenance, doc_text)
    """
    # Get all pins for this schematic version with the nets they're on
    with conn.cursor() as cur:
        cur.execute("""
            SELECT pc.component_ref, COALESCE(pc.pin_name, pc.pin_number::text) AS pin_name, pc.net_name
            FROM pin_connections pc
            WHERE pc.schematic_version_id = %s
        """, (schematic_version_id,))
        pins = cur.fetchall()  # [(component_ref, pin_name, net_name), ...]

    # Map SW facts for this commit by pin_name (simple)
    sw_by_pin: Dict[str, List[Dict[str, Any]]] = {}
    with conn.cursor() as cur:
        cur.execute("""
            SELECT pin_name, af_code, function, evidence
            FROM code_pin_mux_facts
            WHERE commit_id = %s
        """, (commit_id,))
        for pin_name, af_code, function, evidence in cur.fetchall():
            if not pin_name:
                # We'll attach AF-only facts later at doc level
                continue
            sw_by_pin.setdefault(pin_name.upper(), []).append({
                "af_code": af_code, "function": function, "evidence": evidence
            })

    # Also gather AF-only (no pin_name)
    af_only: List[Dict[str, Any]] = []
    with conn.cursor() as cur:
        cur.execute("""
            SELECT af_code, function, evidence
            FROM code_pin_mux_facts
            WHERE commit_id = %s AND pin_name IS NULL
        """, (commit_id,))
        for af_code, function, evidence in cur.fetchall():
            af_only.append({"af_code": af_code, "function": function, "evidence": evidence})

    docs: List[Tuple[str, str, Optional[str], Optional[str], Dict[str, Any], str]] = []
    for component_ref, pin_name, net_name in pins:
        key = (pin_name or "").upper()
        sw = sw_by_pin.get(key, [])
        selected_function = sw[0]["function"] if sw else None

        prov = {
            "hw": {"component_ref": component_ref, "pin_name": pin_name, "net_name": net_name},
            "sw": sw,
            "sw_af_only": af_only[:5] if af_only else [],
        }
        doc = (
            f"{component_ref} {pin_name}: connected to net '{net_name}' in schematic version {schematic_version_id}. "
            f"Software commit {commit_id} "
            + (f"configures {pin_name} as {selected_function}. " if selected_function else "has no explicit pin-mux for this pin. ")
            + ("Alternate-function hints present (e.g., "
               + ", ".join(sorted(set([f'{x.get('af_code')} {x.get('function')}' for x in af_only if x.get('function')])))[:180]
               + ")." if af_only else "")
        ).strip()

        docs.append((component_ref, pin_name, net_name, selected_function, prov, doc))
    return docs

def upsert_pin_facts(conn, *, schematic_version_id: uuid.UUID, commit_id: uuid.UUID, docs: List[Tuple[str, str, Optional[str], Optional[str], Dict[str, Any], str]]):
    if not docs: return
    client = get_openai_client()
    texts = [d[-1] for d in docs]
    embs = []
    # batch embed
    for i in range(0, len(texts), 64):
        embs.extend(embed_batch(client, texts[i:i+64], model=CODE_EMBED_MODEL))
    rows = []
    for (component_ref, pin_name, net_name, selected_function, provenance, doc), emb in zip(docs, embs):
        rows.append({
            "id": uuid.uuid4(),
            "schematic_version_id": schematic_version_id,
            "commit_id": commit_id,
            "component_ref": component_ref,
            "pin_name": pin_name,
            "net_name": net_name,
            "selected_function": selected_function,
            "provenance": Json(provenance),
            "doc": doc,
            "embedding": emb
        })
    with conn.cursor() as cur:
        # Clear previous facts for this (sv, commit) to avoid duplicates on re-ingest
        cur.execute("DELETE FROM pin_facts WHERE schematic_version_id = %s AND commit_id = %s;", (schematic_version_id, commit_id))
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO pin_facts
              (id, schematic_version_id, commit_id, component_ref, pin_name, net_name, selected_function, provenance, doc, embedding)
            VALUES
              (%(id)s, %(schematic_version_id)s, %(commit_id)s, %(component_ref)s, %(pin_name)s, %(net_name)s, %(selected_function)s, %(provenance)s, %(doc)s, %(embedding)s)
        """, rows)

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
    committed_at: Optional[str] = None,
    author: Optional[str] = None,
    message: Optional[str] = None,
    files: List[Tuple[str, bytes]] = [],
    embed_batch_size: int = 32,
) -> Dict[str, Any]:
    """
    Ingest a set of source files for a single commit and link it to a schematic version.
    Adds:
      - code_pin_refs
      - code_pin_mux_facts
      - pin_facts (embedded)
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

        # 2) commit
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
            RETURNING id;""",
            (repo_id, commit_sha, branch_name, committed_at, author, message))
        commit_id = cur.fetchone()[0]

        # 3) files + chunks + NEW: code facts
        inserted_files = 0
        inserted_chunks = 0
        pinref_rows_all: List[Dict[str, Any]] = []
        pinmux_rows_all: List[Dict[str, Any]] = []

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

            # chunk + embed (semantic code search)
            cur.execute("DELETE FROM code_chunks WHERE file_id = %s;", (file_id,))
            chunks = chunk_text(text, max_chars=4000, overlap=400)
            for i in range(0, len(chunks), embed_batch_size):
                batch = chunks[i:i+embed_batch_size]
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
                inserted_chunks += len(rows)

            # --- NEW: extract + buffer code facts ---
            # Numeric pin refs
            for pr in extract_code_pin_refs(text):
                pinref_rows_all.append({
                    "commit_id": commit_id,
                    "file_id": file_id,
                    "symbol": pr["symbol"],
                    "value_int": pr["value_int"],
                    "context": pr["context"]
                })

            # Pin mux facts (devicetree & HAL AF tokens)
            for pm in extract_code_pin_mux_facts(text):
                pinmux_rows_all.append({
                    "id": uuid.uuid4(),
                    "commit_id": commit_id,
                    "file_id": file_id,
                    "component_ref": None,        # can be filled by a linker pass if you map MCU instance
                    "pin_name": pm.get("pin_name"),
                    "af_code": pm.get("af_code"),
                    "function": pm.get("function"),
                    "evidence": Json(pm.get("evidence") or {})
                })

        # Bulk insert code facts
        if pinref_rows_all:
            psycopg2.extras.execute_batch(cur, """
                INSERT INTO code_pin_refs (commit_id, file_id, symbol, value_int, context)
                VALUES (%(commit_id)s, %(file_id)s, %(symbol)s, %(value_int)s, %(context)s)
                ON CONFLICT (commit_id, file_id, symbol) DO UPDATE
                SET value_int = EXCLUDED.value_int, context = EXCLUDED.context
            """, pinref_rows_all)

        if pinmux_rows_all:
            psycopg2.extras.execute_batch(cur, """
                INSERT INTO code_pin_mux_facts (id, commit_id, file_id, component_ref, pin_name, af_code, function, evidence)
                VALUES (%(id)s, %(commit_id)s, %(file_id)s, %(component_ref)s, %(pin_name)s, %(af_code)s, %(function)s, %(evidence)s)
            """, pinmux_rows_all)

        # 4) bind commit ↔ schematic version
        cur.execute("""
            INSERT INTO schematic_code_bindings (project_id, schematic_version_id, repo_id, commit_id, branch_name)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (schematic_version_id, commit_id) DO NOTHING;
        """, (project_id, schematic_version_id, repo_id, commit_id, branch_name))

    # 5) build + embed pin_facts overlay for hybrid queries
    try:
        docs = synthesize_pin_facts_docs(conn, schematic_version_id=schematic_version_id, commit_id=commit_id)
        upsert_pin_facts(conn, schematic_version_id=schematic_version_id, commit_id=commit_id, docs=docs)
    except psycopg2.Error as e:
        # Non-fatal: if HW tables lack data yet, we just skip facts synthesis.
        print(f"[warn] pin_facts synthesis skipped: {e.pgerror or e}")
    except Exception as e:
        print(f"[warn] pin_facts synthesis skipped: {e}")

    return {
        "repo_id": str(repo_id),
        "commit_id": str(commit_id),
        "commit_sha": commit_sha,
        "branch_name": branch_name,
        "files_ingested": inserted_files,
        "chunks_embedded": inserted_chunks,
        "schematic_version_id": str(schematic_version_id),
        "pin_refs_parsed": len(pinref_rows_all),
        "pin_mux_facts_parsed": len(pinmux_rows_all),
    }

# ---------- convenience: ingest a directory on disk ----------
def load_dir_as_files(root_dir: str, include_globs: Optional[List[str]] = None, exclude_globs: Optional[List[str]] = None) -> List[Tuple[str, bytes]]:
    import fnmatch
    files: List[Tuple[str, bytes]] = []
    for base, _, names in os.walk(root_dir):
        for n in names:
            rel = os.path.relpath(os.path.join(base, n), root_dir)
            rel_posix = rel.replace("\\","/")
            if exclude_globs and any(fnmatch.fnmatch(rel_posix, g) for g in exclude_globs):
                continue
            if include_globs and not any(fnmatch.fnmatch(rel_posix, g) for g in include_globs):
                continue
            with open(os.path.join(root_dir, rel), "rb") as f:
                files.append((rel_posix, f.read()))
    return files
