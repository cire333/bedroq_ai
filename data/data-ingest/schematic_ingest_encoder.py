#!/usr/bin/env python3
"""
Ingest a circuit JSON into Postgres + pgvector (versioned hardware layer + HW facts).

What this adds vs. your previous script
- Creates/uses Project and Schematic Version (idempotent via content hash)
- Inserts Components (1536-D), Nets (3072-D), Functional Groups (3072-D)
- Derives & stores HW-facts that downstream code/QA relies on:
  * component_pins (if JSON provides per-pin detail)
  * pin_connections (best-effort: from nets.connected_components; pin is optional)
  * component_models (heuristic MCU identification from components)
- Indexes use HNSW over halfvec + cosine ops (works for 3072 dims, avoids 2000-d IVFFlat limit)

Usage:
  python ingest_vectors.py --json /mnt/data/circuit_analysis.json --project "Starfish"

Env:
  OPENAI_API_KEY, DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE)
"""

import os
import json
import uuid
import argparse
import hashlib
import time
import random
import re
from typing import Any, Dict, List, Optional, Tuple

import psycopg2
import psycopg2.extras
from psycopg2.extras import Json
from pgvector.psycopg2 import register_vector
from openai import OpenAI, RateLimitError

# -----------------------
# Embedding configuration
# -----------------------
MODEL_LARGE = "text-embedding-3-large"   # 3072 dims (nets, functional_groups)
MODEL_SMALL = "text-embedding-3-small"   # 1536 dims (components)

DIMS_LARGE = 3072
DIMS_SMALL = 1536

INGEST_COMPONENTS = True  # toggle to skip component embeddings if needed

# ======================================================
# Connections
# ======================================================
def pg_connect():
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        conn = psycopg2.connect(db_url)
    else:
        conn = psycopg2.connect(
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

def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)

# ======================================================
# Schema (versioned hardware layer + facts)
# ======================================================
def ensure_schema(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # ---------------- Projects & schematic versions ----------------
        cur.execute("""
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          UNIQUE(name)
        );
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS schematic_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id),
          version_tag TEXT,
          content_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          metadata JSONB
        );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS schematic_versions_project_hash ON schematic_versions(project_id, content_hash);")

        # ---------------- Vectorized entity tables ----------------
        # Components (1536-D)
        cur.execute(f"""
        CREATE TABLE IF NOT EXISTS components (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schematic_version_id UUID REFERENCES schematic_versions(id),
          reference TEXT,
          value TEXT,
          description TEXT,
          mpn TEXT,
          datasheet TEXT,
          footprint TEXT,
          library_id TEXT,
          rating TEXT,
          rotation DOUBLE PRECISION,
          position JSONB,
          embedding VECTOR({DIMS_SMALL}),
          UNIQUE (schematic_version_id, reference)
        );
        """)
        # Nets (3072-D)
        cur.execute(f"""
        CREATE TABLE IF NOT EXISTS nets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schematic_version_id UUID REFERENCES schematic_versions(id),
          name TEXT,
          net_type TEXT,
          connected_components TEXT[],
          connection_points JSONB,
          metadata JSONB,
          embedding VECTOR({DIMS_LARGE}),
          UNIQUE (schematic_version_id, name)
        );
        """)
        # Functional groups (3072-D)
        cur.execute(f"""
        CREATE TABLE IF NOT EXISTS functional_groups (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schematic_version_id UUID REFERENCES schematic_versions(id),
          name TEXT,
          description TEXT,
          function TEXT,
          components TEXT[],
          metadata JSONB,
          embedding VECTOR({DIMS_LARGE}),
          UNIQUE (schematic_version_id, name)
        );
        """)

        # ---------------- NEW: hardware fact tables (for HW↔SW linking) ----------------
        # Per-component pin catalog (optional; only if JSON provides per-pin detail)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS component_pins (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schematic_version_id UUID REFERENCES schematic_versions(id),
          component_ref TEXT,
          pin_number INT,
          pin_name TEXT,
          bank TEXT,
          extras JSONB
        );
        """)
        # Unique per component/pin identifier if known
        cur.execute("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'component_pins_unique') THEN
            CREATE UNIQUE INDEX component_pins_unique
            ON component_pins (schematic_version_id, component_ref, COALESCE(pin_name, pin_number::text));
          END IF;
        END$$;
        """)

        # Connection rows (pin may be unknown; we still keep a row to anchor to the net)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS pin_connections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          schematic_version_id UUID REFERENCES schematic_versions(id),
          component_ref TEXT,
          pin_number INT,
          pin_name TEXT,
          net_name TEXT,
          extras JSONB
        );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS pin_connections_net ON pin_connections (schematic_version_id, net_name);")
        cur.execute("CREATE INDEX IF NOT EXISTS pin_connections_comp ON pin_connections (schematic_version_id, component_ref);")

        # Optional MCU model mapping if you can identify the MCU in this schematic version
        cur.execute("""
        CREATE TABLE IF NOT EXISTS component_models (
          schematic_version_id UUID REFERENCES schematic_versions(id),
          component_ref TEXT,
          mcu_model TEXT,
          PRIMARY KEY (schematic_version_id, component_ref)
        );
        """)

        # ---------------- ANN indexes: cosine over halfvec ----------------
        cur.execute("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'nets_hnsw_halfvec_cos') THEN
            CREATE INDEX nets_hnsw_halfvec_cos ON nets
            USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
          END IF;
        END$$;
        """)
        cur.execute("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'fgroups_hnsw_halfvec_cos') THEN
            CREATE INDEX fgroups_hnsw_halfvec_cos ON functional_groups
            USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);
          END IF;
        END$$;
        """)
        cur.execute("""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'components_hnsw_halfvec_cos') THEN
            CREATE INDEX components_hnsw_halfvec_cos ON components
            USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops);
          END IF;
        END$$;
        """)

        # Helpful JSON/text indexes
        cur.execute("""
        CREATE INDEX IF NOT EXISTS components_metadata_tsv
        ON components
        USING gin (to_tsvector('simple', coalesce(description,'') || ' ' || coalesce(value,'')));
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS nets_metadata_gin ON nets USING gin ((metadata));")
        cur.execute("CREATE INDEX IF NOT EXISTS functional_groups_metadata_gin ON functional_groups USING gin ((metadata));")
        cur.execute("ANALYZE;")

# ======================================================
# Project & Version helpers
# ======================================================
def get_or_create_project(conn, name: str) -> uuid.UUID:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM projects WHERE name = %s LIMIT 1;", (name,))
        row = cur.fetchone()
        if row:
            return row[0]
        cur.execute("INSERT INTO projects (name) VALUES (%s) RETURNING id;", (name,))
        return cur.fetchone()[0]

def stable_hash(obj: Any) -> str:
    s = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def get_or_create_schematic_version(conn, project_id: uuid.UUID, version_tag: Optional[str], analysis_json: Dict[str, Any]) -> uuid.UUID:
    # Hash the whole "analysis" block to capture all fields (components/nets/groups/metadata)
    content_hash = stable_hash(analysis_json)
    with conn.cursor() as cur:
        cur.execute("""
          SELECT id FROM schematic_versions
          WHERE project_id = %s AND content_hash = %s
          LIMIT 1;
        """, (project_id, content_hash))
        row = cur.fetchone()
        if row:
            return row[0]

        md = analysis_json.get("metadata", {}) or {}
        extra = {k: v for k, v in analysis_json.items() if k not in ("components", "nets", "functional_groups")}
        merged_md = {"metadata": md, "extra": extra}

        cur.execute("""
          INSERT INTO schematic_versions (project_id, version_tag, content_hash, metadata)
          VALUES (%s, %s, %s, %s) RETURNING id;
        """, (project_id, version_tag, content_hash, Json(merged_md)))
        return cur.fetchone()[0]

# ======================================================
# Embedding helpers (batch + retry)
# ======================================================
def embed_texts(client: OpenAI, texts: List[str], model: str, max_retries: int = 6) -> List[List[float]]:
    if not texts:
        return []
    delay = 0.6
    for attempt in range(max_retries):
        try:
            resp = client.embeddings.create(model=model, input=texts)
            out: List[List[float]] = []
            for item in getattr(resp, "data", []):
                vec = getattr(item, "embedding", None)
                if vec is None:
                    vec = item["embedding"]  # fallback if dict-like
                out.append(list(vec))
            return out
        except RateLimitError:
            time.sleep(delay * (2 ** attempt) + random.uniform(0, 0.4))
    raise RuntimeError("OpenAI embeddings rate-limited after retries.")

# ======================================================
# Text builders for embeddings
# ======================================================
def build_component_text(c: Dict[str, Any]) -> str:
    desc = c.get("description") or ""
    ref = c.get("reference") or ""
    val = c.get("value") or ""
    rating = c.get("rating") or ""
    mpn = c.get("mpn") or ""
    fp = c.get("footprint") or ""
    lib = c.get("library_id") or ""
    datasheet = c.get("datasheet") or ""
    pos = c.get("position") or {}
    pos_s = f"x={pos.get('x')}, y={pos.get('y')}" if pos else ""
    return (f"Component {ref}: {val}. {desc}. Rating: {rating}. MPN: {mpn}. "
            f"Footprint: {fp}. Library: {lib}. Datasheet: {datasheet}. Position: {pos_s}.").strip()

def build_net_text(n: Dict[str, Any]) -> str:
    name = n.get("name") or ""
    ntype = n.get("net_type") or ""
    comps = n.get("connected_components") or []
    cps = n.get("connection_points") or []
    return (f"Net {name}. Type: {ntype}. Connected components: {', '.join(comps) if comps else 'none'}. "
            f"Connection points: {len(cps)}.").strip()

def build_functional_group_text(g: Dict[str, Any]) -> str:
    name = g.get("name") or ""
    desc = g.get("description") or ""
    comps = g.get("components") or []
    func = g.get("function") or ""
    return (f"Functional group {name}. Function: {func}. Description: {desc}. "
            f"Components: {', '.join(comps) if comps else 'none'}.").strip()

# ======================================================
# NEW: Derivations from JSON → HW fact rows
# ======================================================
MCU_PATTERNS = [
    r"\bSTM32[A-Z0-9]+\b", r"\bSTM32F\d+\b", r"\bSTM32G\d+\b", r"\bSTM32H\d+\b",
    r"\bATSAMD\d+\b", r"\bATmega\d+\b", r"\bESP32[-A-Z0-9]*\b", r"\bRP2040\b",
    r"\bnRF52\d+\b", r"\bnRF53\d+\b"
]
MCU_REGEX = re.compile("|".join(MCU_PATTERNS), re.I)

def derive_component_models(components: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows = []
    for c in components or []:
        ref = c.get("reference")
        txt = " ".join(filter(None, [c.get("value"), c.get("mpn"), c.get("description"), c.get("library_id")]))
        if not txt:
            continue
        m = MCU_REGEX.search(txt)
        if m:
            rows.append({"component_ref": ref, "mcu_model": m.group(0).upper()})
    return rows

def derive_component_pins(components: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Accepts flexible shapes:
    - c["pins"] may be a list of dicts like {"number":1,"name":"PA9","bank":"A"} OR strings
    If no usable pin data, returns [] (non-fatal).
    """
    out: List[Dict[str, Any]] = []
    for c in components or []:
        ref = c.get("reference")
        pins = c.get("pins") or []
        for p in pins:
            if isinstance(p, dict):
                pin_number = p.get("number")
                pin_name = p.get("name")
                bank = p.get("bank")
                extras = {k: v for k, v in p.items() if k not in ("number", "name", "bank")}
                if pin_number is None and not pin_name:
                    continue
                out.append({
                    "component_ref": ref,
                    "pin_number": pin_number,
                    "pin_name": pin_name,
                    "bank": bank,
                    "extras": extras or None
                })
            # strings or empty entries are ignored
    return out

def derive_pin_connections(nets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Best-effort: from each net, attach all connected_components.
    Pin may be unknown (pin_name/pin_number left NULL). This still gives:
      (schematic_version_id, component_ref, net_name) for downstream joins.
    """
    out: List[Dict[str, Any]] = []
    for n in nets or []:
        net_name = n.get("name")
        for comp_ref in (n.get("connected_components") or []):
            out.append({
                "component_ref": comp_ref,
                "pin_number": None,
                "pin_name": None,
                "net_name": net_name,
                "extras": {"net_type": n.get("net_type")}
            })
    return out

# ======================================================
# Upserts (versioned)
# ======================================================
def upsert_components(conn, sv_id: uuid.UUID, rows: List[Dict[str, Any]]):
    if not rows:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO components (
              id, schematic_version_id, reference, value, description, mpn, datasheet,
              footprint, library_id, rating, rotation, position, embedding
            )
            VALUES (
              %(id)s, %(schematic_version_id)s, %(reference)s, %(value)s, %(description)s, %(mpn)s, %(datasheet)s,
              %(footprint)s, %(library_id)s, %(rating)s, %(rotation)s, %(position)s, %(embedding)s
            )
            ON CONFLICT (schematic_version_id, reference) DO UPDATE SET
              value = EXCLUDED.value,
              description = EXCLUDED.description,
              mpn = EXCLUDED.mpn,
              datasheet = EXCLUDED.datasheet,
              footprint = EXCLUDED.footprint,
              library_id = EXCLUDED.library_id,
              rating = EXCLUDED.rating,
              rotation = EXCLUDED.rotation,
              position = EXCLUDED.position,
              embedding = EXCLUDED.embedding;
        """, rows)

def upsert_nets(conn, sv_id: uuid.UUID, rows: List[Dict[str, Any]]):
    if not rows:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO nets (
              id, schematic_version_id, name, net_type, connected_components, connection_points, metadata, embedding
            )
            VALUES (
              %(id)s, %(schematic_version_id)s, %(name)s, %(net_type)s, %(connected_components)s,
              %(connection_points)s, %(metadata)s, %(embedding)s
            )
            ON CONFLICT (schematic_version_id, name) DO UPDATE SET
              net_type = EXCLUDED.net_type,
              connected_components = EXCLUDED.connected_components,
              connection_points = EXCLUDED.connection_points,
              metadata = EXCLUDED.metadata,
              embedding = EXCLUDED.embedding;
        """, rows)

def upsert_functional_groups(conn, sv_id: uuid.UUID, rows: List[Dict[str, Any]]):
    if not rows:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO functional_groups (
              id, schematic_version_id, name, description, function, components, metadata, embedding
            )
            VALUES (
              %(id)s, %(schematic_version_id)s, %(name)s, %(description)s, %(function)s, %(components)s, %(metadata)s, %(embedding)s
            )
            ON CONFLICT (schematic_version_id, name) DO UPDATE SET
              description = EXCLUDED.description,
              function = EXCLUDED.function,
              components = EXCLUDED.components,
              metadata = EXCLUDED.metadata,
              embedding = EXCLUDED.embedding;
        """, rows)

def upsert_component_pins(conn, sv_id: uuid.UUID, rows: List[Dict[str, Any]]):
    if not rows:
        return
    for r in rows:
        r["id"] = uuid.uuid4()
        r["schematic_version_id"] = sv_id
        r["extras"] = Json(r.get("extras") or {})
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO component_pins (id, schematic_version_id, component_ref, pin_number, pin_name, bank, extras)
            VALUES (%(id)s, %(schematic_version_id)s, %(component_ref)s, %(pin_number)s, %(pin_name)s, %(bank)s, %(extras)s)
            ON CONFLICT ON CONSTRAINT component_pins_unique DO NOTHING;
        """, rows)

def upsert_pin_connections(conn, sv_id: uuid.UUID, rows: List[Dict[str, Any]]):
    if not rows:
        return
    for r in rows:
        r["id"] = uuid.uuid4()
        r["schematic_version_id"] = sv_id
        r["extras"] = Json(r.get("extras") or {})
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO pin_connections (id, schematic_version_id, component_ref, pin_number, pin_name, net_name, extras)
            VALUES (%(id)s, %(schematic_version_id)s, %(component_ref)s, %(pin_number)s, %(pin_name)s, %(net_name)s, %(extras)s)
            ON CONFLICT DO NOTHING;
        """, rows)

def upsert_component_models(conn, sv_id: uuid.UUID, rows: List[Dict[str, Any]]):
    if not rows:
        return
    for r in rows:
        r["schematic_version_id"] = sv_id
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO component_models (schematic_version_id, component_ref, mcu_model)
            VALUES (%(schematic_version_id)s, %(component_ref)s, %(mcu_model)s)
            ON CONFLICT (schematic_version_id, component_ref) DO UPDATE
            SET mcu_model = EXCLUDED.mcu_model;
        """, rows)

# ======================================================
# Main
# ======================================================
def main():
    parser = argparse.ArgumentParser(description="Ingest circuit JSON into versioned pgvector + HW facts")
    parser.add_argument("--json", default="/mnt/data/circuit_analysis.json", help="Path to JSON file")
    parser.add_argument("--project", default=None, help="Project name (default: analysis.metadata.title or 'Default Project')")
    parser.add_argument("--version-tag", default=None, help="Version tag (default: analysis.metadata.revision if present)")
    parser.add_argument("--skip-components", action="store_true", help="Skip ingesting components")
    parser.add_argument("--batch", type=int, default=64, help="Embedding batch size (default 64)")
    args = parser.parse_args()

    global INGEST_COMPONENTS
    if args.skip_components:
        INGEST_COMPONENTS = False

    with open(args.json, "r", encoding="utf-8") as f:
        data = json.load(f)

    analysis = data.get("analysis", {})
    metadata = analysis.get("metadata", {}) or {}
    project_name = args.project or metadata.get("title") or "Default Project"
    version_tag = args.version_tag or metadata.get("revision")

    components = analysis.get("components", []) if INGEST_COMPONENTS else []
    nets = analysis.get("nets", []) or []
    functional_groups = analysis.get("functional_groups", []) or []

    client = get_openai_client()
    conn = pg_connect()
    ensure_schema(conn)

    project_id = get_or_create_project(conn, project_name)
    sv_id = get_or_create_schematic_version(conn, project_id, version_tag, analysis)

    # -------------------------
    # Ingest components (1536)
    # -------------------------
    if INGEST_COMPONENTS and components:
        texts = [build_component_text(c) for c in components]
        rows: List[Dict[str, Any]] = []
        for i in range(0, len(texts), args.batch):
            chunk = texts[i:i+args.batch]
            embs = embed_texts(client, chunk, MODEL_SMALL)
            for j, emb in enumerate(embs):
                c = components[i + j]
                rows.append({
                    "id": uuid.uuid4(),
                    "schematic_version_id": sv_id,
                    "reference": c.get("reference"),
                    "value": c.get("value"),
                    "description": c.get("description"),
                    "mpn": c.get("mpn"),
                    "datasheet": c.get("datasheet"),
                    "footprint": c.get("footprint"),
                    "library_id": c.get("library_id"),
                    "rating": c.get("rating"),
                    "rotation": c.get("rotation"),
                    "position": Json(c.get("position") or {}),
                    "embedding": emb,
                })
        upsert_components(conn, sv_id, rows)

    # -------------------------
    # Ingest nets (3072)
    # -------------------------
    if nets:
        texts = [build_net_text(n) for n in nets]
        rows = []
        for i in range(0, len(texts), args.batch):
            chunk = texts[i:i+args.batch]
            embs = embed_texts(client, chunk, MODEL_LARGE)
            for j, emb in enumerate(embs):
                n = nets[i + j]
                rows.append({
                    "id": uuid.uuid4(),
                    "schematic_version_id": sv_id,
                    "name": n.get("name"),
                    "net_type": n.get("net_type"),
                    "connected_components": n.get("connected_components") or [],
                    "connection_points": Json(n.get("connection_points") or []),
                    "metadata": Json({k: v for k, v in n.items() if k not in {"name", "net_type", "connected_components", "connection_points"}}),
                    "embedding": emb,
                })
        upsert_nets(conn, sv_id, rows)

    # -------------------------
    # Ingest functional groups (3072)
    # -------------------------
    if functional_groups:
        texts = [build_functional_group_text(g) for g in functional_groups]
        rows = []
        for i in range(0, len(texts), args.batch):
            chunk = texts[i:i+args.batch]
            embs = embed_texts(client, chunk, MODEL_LARGE)
            for j, emb in enumerate(embs):
                g = functional_groups[i + j]
                rows.append({
                    "id": uuid.uuid4(),
                    "schematic_version_id": sv_id,
                    "name": g.get("name"),
                    "description": g.get("description"),
                    "function": g.get("function"),
                    "components": g.get("components") or [],
                    "metadata": Json({k: v for k, v in g.items() if k not in {"name", "description", "function", "components"}}),
                    "embedding": emb,
                })
        upsert_functional_groups(conn, sv_id, rows)

    # -------------------------
    # NEW: derive & store HW facts from JSON
    # -------------------------
    try:
        # component_pins (only if JSON has per-pin info)
        cp_rows = derive_component_pins(components)
        upsert_component_pins(conn, sv_id, cp_rows)

        # pin_connections (best-effort from nets.connected_components)
        pc_rows = derive_pin_connections(nets)
        upsert_pin_connections(conn, sv_id, pc_rows)

        # component_models (heuristic MCU detection)
        cm_rows = derive_component_models(components)
        upsert_component_models(conn, sv_id, cm_rows)
    except Exception as e:
        print(f"[warn] HW facts derivation skipped/partial: {e}")

    print(f"✅ Ingestion complete. project='{project_name}' version_tag='{version_tag}' sv_id={sv_id}")

if __name__ == "__main__":
    main()
