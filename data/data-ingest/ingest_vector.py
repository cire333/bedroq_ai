#!/usr/bin/env python3
"""
Ingest a circuit JSON into Postgres + pgvector (versioned hardware layer).

- Creates/uses a Project
- Creates/uses a Schematic Version (idempotent via content hash)
- Inserts Components (1536-D), Nets (3072-D), Functional Groups (3072-D)
- Indexes use HNSW over halfvec + cosine ops (good for 3072 dims, avoids 2000-d IVFFlat limit)

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
from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras
from psycopg2.extras import Json, RealDictCursor
from pgvector.psycopg2 import register_vector

import time, random
from openai import OpenAI, RateLimitError

# OpenAI python SDK >= 1.0
try:
    from openai import OpenAI
except ImportError:
    # fallback for older package name; but strongly recommend: pip install openai>=1.0.0 psycopg2-binary
    raise

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
# Schema (versioned hardware layer)
# ======================================================
def ensure_schema(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # Projects & schematic versions
        cur.execute("""
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
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

        # ANN indexes: cosine over halfvec
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

        # Helpful JSON indexes
        cur.execute("CREATE INDEX IF NOT EXISTS components_metadata_gin ON components USING gin (to_tsvector('simple', coalesce(description,'') || ' ' || coalesce(value,'')));")
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

        # Store metadata: take analysis.metadata plus high-level keys besides the heavy arrays (keeps it useful/readable)
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

# ======================================================
# Main
# ======================================================
def main():
    parser = argparse.ArgumentParser(description="Ingest circuit JSON into versioned pgvector")
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

    print(f"✅ Ingestion complete. project='{project_name}' version_tag='{version_tag}' sv_id={sv_id}")

if __name__ == "__main__":
    main()
