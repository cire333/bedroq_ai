#!/usr/bin/env python3
"""
Ingest circuit JSON into Postgres + pgvector with mixed dimensions:
- nets, functional_groups: 3072 dims (text-embedding-3-large)
- components: 1536 dims (text-embedding-3-small) [optional]

python ingest_vectors.py --json circuit_analysis.json
"""

import os
import json
import uuid
import argparse
from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras
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
MODEL_LARGE = "text-embedding-3-large"   # 3072 dims
MODEL_SMALL = "text-embedding-3-small"   # 1536 dims

DIMS_LARGE = 3072
DIMS_SMALL = 1536

# Toggle whether to also store components (1536-D)
INGEST_COMPONENTS = True

def pg_connect():
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        conn = psycopg2.connect(db_url)
    else:
        # Use discrete PG env vars
        conn = psycopg2.connect(
            host=os.getenv("PGHOST", "localhost"),
            port=int(os.getenv("PGPORT", "5432")),
            user=os.getenv("PGUSER", "postgres"),
            password=os.getenv("PGPASSWORD", ""),
            dbname=os.getenv("PGDATABASE", "postgres"),
        )
    conn.autocommit = True

    # Make psycopg2 understand Python uuid.UUID
    psycopg2.extras.register_uuid(conn_or_curs=conn)

    # Make psycopg2 understand pgvector values (Python lists -> VECTOR)
    register_vector(conn)
    return conn


def ensure_schema(conn):
    with conn.cursor() as cur:
        # Enable pgvector
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        if INGEST_COMPONENTS:
            cur.execute(f"""
            CREATE TABLE IF NOT EXISTS components (
                id UUID PRIMARY KEY,
                reference TEXT,
                value TEXT,
                description TEXT,
                mpn TEXT,
                datasheet TEXT,
                position JSONB,
                rating TEXT,
                footprint TEXT,
                library_id TEXT,
                metadata JSONB,
                embedding VECTOR({DIMS_SMALL})
            );
            """)
            # Index for ANN
            cur.execute("""
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_indexes WHERE indexname = 'components_embedding_ivfflat'
              ) THEN
                CREATE INDEX components_embedding_ivfflat ON components
                USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
              END IF;
            END$$;
            """)

        cur.execute(f"""
        CREATE TABLE IF NOT EXISTS nets (
            id UUID PRIMARY KEY,
            name TEXT,
            net_type TEXT,
            connected_components TEXT[],
            connection_points JSONB,
            metadata JSONB,
            embedding VECTOR({DIMS_LARGE})
        );
        """)
        cur.execute("""
        DO $$
        BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'nets_embedding_hnsw_halfvec'
        ) THEN
            CREATE INDEX nets_embedding_hnsw_halfvec
            ON nets
            USING hnsw ((embedding::halfvec(3072)) halfvec_l2_ops);
        END IF;
        END$$;
        """)

        cur.execute(f"""
        CREATE TABLE IF NOT EXISTS functional_groups (
            id UUID PRIMARY KEY,
            name TEXT,
            description TEXT,
            components TEXT[],
            function TEXT,
            metadata JSONB,
            embedding VECTOR({DIMS_LARGE})
        );
        """)
        cur.execute("""
        DO $$
        BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'functional_groups_embedding_hnsw_halfvec'
        ) THEN
            CREATE INDEX functional_groups_embedding_hnsw_halfvec
            ON functional_groups
            USING hnsw ((embedding::halfvec(3072)) halfvec_l2_ops);
        END IF;
        END$$;
        """)

        # Helpful GIN indexes for metadata filters
        if INGEST_COMPONENTS:
            cur.execute("CREATE INDEX IF NOT EXISTS components_metadata_gin ON components USING gin (metadata);")
        cur.execute("CREATE INDEX IF NOT EXISTS nets_metadata_gin ON nets USING gin (metadata);")
        cur.execute("CREATE INDEX IF NOT EXISTS functional_groups_metadata_gin ON functional_groups USING gin (metadata);")

        # ANALYZE for planner stats
        cur.execute("ANALYZE;")


def build_component_text(c: Dict[str, Any]) -> str:
    # Compose a concise but rich description for embedding
    desc = c.get("description") or ""
    ref = c.get("reference") or ""
    val = c.get("value") or ""
    rating = c.get("rating") or ""
    mpn = c.get("mpn") or ""
    fp = c.get("footprint") or ""
    lib = c.get("library_id") or ""
    datasheet = c.get("datasheet") or ""

    # position, pins, etc.
    pos = c.get("position") or {}
    pos_s = f"x={pos.get('x')}, y={pos.get('y')}" if pos else ""

    return (
        f"Component {ref}: {val}. {desc}. "
        f"Rating: {rating}. MPN: {mpn}. Footprint: {fp}. Library: {lib}. "
        f"Datasheet: {datasheet}. Position: {pos_s}."
    ).strip()


def build_net_text(n: Dict[str, Any]) -> str:
    name = n.get("name") or ""
    ntype = n.get("net_type") or ""
    comps = n.get("connected_components") or []
    cps = n.get("connection_points") or []
    cp_count = len(cps)
    return (
        f"Net {name}. Type: {ntype}. "
        f"Connected components: {', '.join(comps) if comps else 'none'}. "
        f"Connection points: {cp_count}."
    ).strip()


def build_functional_group_text(g: Dict[str, Any]) -> str:
    name = g.get("name") or ""
    desc = g.get("description") or ""
    comps = g.get("components") or []
    func = g.get("function") or ""
    return (
        f"Functional group {name}. Function: {func}. Description: {desc}. "
        f"Components: {', '.join(comps) if comps else 'none'}."
    ).strip()


def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)


# def embed_texts(client: OpenAI, texts: List[str], model: str) -> List[List[float]]:
#     # Batch embed to reduce roundtrips
#     # Batch embed to reduce roundtrips
#     delay = 1.0
#     max_retries=6
#     for attempt in range(max_retries):
#         try:
#             return client.embeddings.create(model=model, input=texts)
#         except RateLimitError as e:
#             # 429: back off, then retry
#             sleep_for = delay * (2 ** attempt) + random.uniform(0, 0.5)
#             time.sleep(sleep_for)
#     raise RuntimeError("Gave up after retries due to rate limits.")

def embed_texts(client, texts, model):
    """
    Return List[List[float]] (NOT Embedding objects / pydantic models).
    Handles both new (v1) and legacy OpenAI SDK shapes.
    """
    if not texts:
        return []
    resp = client.embeddings.create(model=model, input=texts)

    vecs = []
    # New SDK: resp.data = list[openai.types.Embedding]
    for item in getattr(resp, "data", []):
        vec = getattr(item, "embedding", None)
        if vec is None:
            # Legacy shape: dict-like
            try:
                vec = item["embedding"]
            except Exception:
                raise TypeError(f"Unexpected embedding payload item type: {type(item)}")

        # Ensure it's a plain python list[float]
        if hasattr(vec, "tolist"):
            vec = vec.tolist()
        vec = list(vec)

        # Optional sanity checks
        if not vec or not isinstance(vec[0], (int, float)):
            raise TypeError(f"Embedding is not numeric list: {type(vec)} first={type(vec[0])}")
        vecs.append(vec)

    return vecs


def upsert_components(conn, rows: List[Dict[str, Any]]):
    if not rows:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO components (id, reference, value, description, mpn, datasheet,
                                    position, rating, footprint, library_id, metadata, embedding)
            VALUES (%(id)s, %(reference)s, %(value)s, %(description)s, %(mpn)s, %(datasheet)s,
                    %(position)s, %(rating)s, %(footprint)s, %(library_id)s, %(metadata)s, %(embedding)s)
            ON CONFLICT (id) DO UPDATE SET
                reference = EXCLUDED.reference,
                value = EXCLUDED.value,
                description = EXCLUDED.description,
                mpn = EXCLUDED.mpn,
                datasheet = EXCLUDED.datasheet,
                position = EXCLUDED.position,
                rating = EXCLUDED.rating,
                footprint = EXCLUDED.footprint,
                library_id = EXCLUDED.library_id,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
        """, rows)


def upsert_nets(conn, rows: List[Dict[str, Any]]):
    if not rows:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO nets (id, name, net_type, connected_components, connection_points, metadata, embedding)
            VALUES (%(id)s, %(name)s, %(net_type)s, %(connected_components)s, %(connection_points)s, %(metadata)s, %(embedding)s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                net_type = EXCLUDED.net_type,
                connected_components = EXCLUDED.connected_components,
                connection_points = EXCLUDED.connection_points,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
        """, rows)


def upsert_functional_groups(conn, rows: List[Dict[str, Any]]):
    if not rows:
        return
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, """
            INSERT INTO functional_groups (id, name, description, components, function, metadata, embedding)
            VALUES (%(id)s, %(name)s, %(description)s, %(components)s, %(function)s, %(metadata)s, %(embedding)s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                components = EXCLUDED.components,
                function = EXCLUDED.function,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
        """, rows)


def main():
    parser = argparse.ArgumentParser(description="Ingest circuit JSON into pgvector")
    parser.add_argument("--json", default="/mnt/data/circuit_analysis.json",
                        help="Path to JSON file (default: /mnt/data/circuit_analysis.json)")
    parser.add_argument("--skip-components", action="store_true",
                        help="Skip ingesting components")
    parser.add_argument("--batch", type=int, default=64,
                        help="Embedding batch size (default 64)")
    args = parser.parse_args()

    global INGEST_COMPONENTS
    if args.skip_components:
        INGEST_COMPONENTS = False

    with open(args.json, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    analysis = data.get("analysis", {})
    components = analysis.get("components", []) if INGEST_COMPONENTS else []
    nets = analysis.get("nets", [])
    functional_groups = analysis.get("functional_groups", [])

    client = get_openai_client()
    conn = pg_connect()
    ensure_schema(conn)

    # -------------------------
    # Ingest components (1536)
    # -------------------------
    if INGEST_COMPONENTS and components:
        texts = [build_component_text(c) for c in components]
        rows: List[Dict[str, Any]] = []
        # Batch to comply with API limits
        for i in range(0, len(texts), args.batch):
            chunk = texts[i:i + args.batch]
            embs = embed_texts(client, chunk, MODEL_SMALL)
            for j, emb in enumerate(embs):
                c = components[i + j]
                rows.append({
                    "id": uuid.uuid4(),
                    "reference": c.get("reference"),
                    "value": c.get("value"),
                    "description": c.get("description"),
                    "mpn": c.get("mpn"),
                    "datasheet": c.get("datasheet"),
                    "position": json.dumps(c.get("position") or {}),
                    "rating": c.get("rating"),
                    "footprint": c.get("footprint"),
                    "library_id": c.get("library_id"),
                    "metadata": json.dumps({k: v for k, v in c.items() if k not in {
                        "reference", "value", "description", "mpn", "datasheet", "position",
                        "rating", "footprint", "library_id"
                    }}),
                    "embedding": emb,
                })
        upsert_components(conn, rows)

    # -------------------------
    # Ingest nets (3072)
    # -------------------------
    if nets:
        texts = [build_net_text(n) for n in nets]
        rows = []
        for i in range(0, len(texts), args.batch):
            chunk = texts[i:i + args.batch]
            embs = embed_texts(client, chunk, MODEL_LARGE)
            for j, emb in enumerate(embs):
                n = nets[i + j]
                rows.append({
                    "id": uuid.uuid4(),
                    "name": n.get("name"),
                    "net_type": n.get("net_type"),
                    "connected_components": n.get("connected_components") or [],
                    "connection_points": json.dumps(n.get("connection_points") or []),
                    "metadata": json.dumps({k: v for k, v in n.items() if k not in {
                        "name", "net_type", "connected_components", "connection_points"
                    }}),
                    "embedding": emb,
                })
        upsert_nets(conn, rows)

    # -------------------------
    # Ingest functional groups (3072)
    # -------------------------
    if functional_groups:
        texts = [build_functional_group_text(g) for g in functional_groups]
        rows = []
        for i in range(0, len(texts), args.batch):
            chunk = texts[i:i + args.batch]
            embs = embed_texts(client, chunk, MODEL_LARGE)
            for j, emb in enumerate(embs):
                g = functional_groups[i + j]
                rows.append({
                    "id": uuid.uuid4(),
                    "name": g.get("name"),
                    "description": g.get("description"),
                    "components": g.get("components") or [],
                    "function": g.get("function"),
                    "metadata": json.dumps({k: v for k, v in g.items() if k not in {
                        "name", "description", "components", "function"
                    }}),
                    "embedding": emb,
                })
        upsert_functional_groups(conn, rows)

    print("✅ Ingestion complete.")


if __name__ == "__main__":
    main()
