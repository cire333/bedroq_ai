#!/usr/bin/env python3
"""
End-to-end test for the HW+SW stack:
- Creates a project
- Ingests schematic v1 & v2 (with a deliberate pin change)
- Ingests a code snapshot bound to v2 that still uses pin 5
- Runs vector and relational queries including HW↔SW mismatch

Usage:
  export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
  python embedding_test.py
"""

import os, io, json, uuid, copy, hashlib, random, time, sys
import psycopg2, psycopg2.extras
from psycopg2.extras import RealDictCursor, Json

# --- Adjust these imports to your actual module/file names ---
# schematic ingest module (the big one you updated last)
# code ingest module (the one for repo/commits/chunks)
import importlib

from dotenv import load_dotenv

# Load variables from env.dev file
load_dotenv("../../../env.dev")

sys.path.append(os.path.abspath(".."))

# Try default filenames; change if yours differ
SCHEMA_MOD_NAME = os.getenv("SCHEMA_MOD", "schematic_ingest_encoder")     # e.g. ingest_vectors.py (the “versioned hardware layer + facts” one)
CODE_MOD_NAME   = os.getenv("CODE_MOD",   "source_code_encoder")   # e.g. the code ingest file you created earlier

schema_mod = importlib.import_module(SCHEMA_MOD_NAME)
code_mod   = importlib.import_module(CODE_MOD_NAME)

def _det_hash(s: str) -> bytes:
    return hashlib.sha256(s.encode("utf-8", errors="ignore")).digest()

def _hash_to_vec(text: str, dims: int) -> list[float]:
    # Deterministic pseudo-random vector in [-1, 1] from sha256
    h = _det_hash(text)
    rnd = random.Random(h)  # seed from hash
    return [rnd.uniform(-1.0, 1.0) for _ in range(dims)]

def fake_embed_texts(texts: list[str], model: str, **_):
    dims = 3072 if "large" in model else 1536
    return [_hash_to_vec(t, dims) for t in texts]

def fake_embed_batch(client, texts: list[str], model="text-embedding-3-small", **_):
    dims = 1536
    return [_hash_to_vec(t, dims) for t in texts]

# --------------------------
# Helpers
# --------------------------
def pg_connect():
    url = os.getenv("DATABASE_URL", "postgresql://ericvalasek:ericeric@localhost:5432/bedroq_vector_data")
    conn = psycopg2.connect(url)
    conn.autocommit = True
    psycopg2.extras.register_uuid(conn_or_curs=conn)
    try:
        from pgvector.psycopg2 import register_vector
        register_vector(conn)
    except Exception:
        pass
    return conn

def run_sql(conn, sql, args=None):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, args or [])
        return cur.fetchall()

# --------------------------
# Build v1 and v2 schematics
# --------------------------
def load_example_json():
    # Use the example you uploaded earlier
    with open("../schematics/circuit.json", "r", encoding="utf-8") as f:
        return json.load(f)

def make_v1_v2(base_json: dict) -> tuple[dict,dict]:
    """
    Create two versions:
      v1: adds artificial MCU 'U100' with UART_TX on pin 5
      v2: same MCU but UART_TX moved to pin 6
    Also add an explicit net 'UART_TX' connecting U100.
    """
    data_v1 = copy.deepcopy(base_json)
    data_v2 = copy.deepcopy(base_json)

    # compact handles
    a1 = data_v1.setdefault("analysis", {})
    a2 = data_v2.setdefault("analysis", {})
    for a in (a1, a2):
        a.setdefault("components", [])
        a.setdefault("nets", [])
        a.setdefault("functional_groups", [])

    # MCU component (toy)
    u100_common = {
        "reference": "U100",
        "value": "MCU-TEST",
        "footprint": "Package_QFN:QFN-48",
        "library_id": "MCU_Generic",
        "position": {"x": 10.0, "y": 10.0},
        "rotation": 0.0,
        "datasheet": "",
        "mpn": "MCU-TEST-123",
        "rating": "",
        "description": "Test MCU for E2E pin-change demonstration",
    }
    u100_v1 = copy.deepcopy(u100_common)
    u100_v1["pins"] = [{"number": 5, "name": "UART_TX"}]

    u100_v2 = copy.deepcopy(u100_common)
    u100_v2["pins"] = [{"number": 6, "name": "UART_TX"}]

    # Add/replace U100 in comps (in case repeats)
    def upsert_comp(arr, comp):
        arr[:] = [c for c in arr if c.get("reference") != comp["reference"]]
        arr.append(comp)

    upsert_comp(a1["components"], u100_v1)
    upsert_comp(a2["components"], u100_v2)

    # Add a UART_TX net that connects to U100 (component-level granularity only)
    uart_net_v1 = {"name": "UART_TX", "connected_components": ["U100"], "connection_points": [], "net_type": "signal"}
    uart_net_v2 = copy.deepcopy(uart_net_v1)

    # Upsert net in both versions
    def upsert_net(arr, net):
        arr[:] = [n for n in arr if n.get("name") != net["name"]]
        arr.append(net)

    upsert_net(a1["nets"], uart_net_v1)
    upsert_net(a2["nets"], uart_net_v2)

    # Tag revisions
    m1 = a1.setdefault("metadata", {})
    m2 = a2.setdefault("metadata", {})
    m1["revision"] = "v1"
    m2["revision"] = "v2"

    return data_v1, data_v2

# --------------------------
# Small code snapshot
# --------------------------
def make_code_files_using_pin_5() -> list[tuple[str, bytes]]:
    src = b"""\
#include <stdint.h>
#define UART_TX_PIN 5

void uart_init(void) {
  // configure pin 5 for UART TX
  (void)UART_TX_PIN;
}

int main(void) {
  uart_init();
  return 0;
}
"""
    return [("src/uart.c", src)]

# --------------------------
# Vector searches
# --------------------------
def search_nets_by_text(conn, sv_id: uuid.UUID, query_vec: list[float]):
    # cosine search on nets
    sql = """
    SELECT name, net_type
    FROM nets
    WHERE schematic_version_id = %s
    ORDER BY (embedding::halfvec(3072)) <=> ((%s)::vector)::halfvec(3072)
    LIMIT 5;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (sv_id, query_vec))
        return cur.fetchall()

def embed_q(text: str) -> list[float]:
    # real call via schema_mod (uses OpenAI)
    return schema_mod.embed_texts(schema_mod.get_openai_client(), [text], "text-embedding-3-large")[0]

# --------------------------
# Diff & mismatch queries
# --------------------------
PIN_DIFF_SQL = """
WITH v1 AS (
  SELECT cp.component_ref, cp.pin_name, cp.pin_number
  FROM component_pins cp
  WHERE cp.schematic_version_id = %(sv1)s
),
v2 AS (
  SELECT cp.component_ref, cp.pin_name, cp.pin_number
  FROM component_pins cp
  WHERE cp.schematic_version_id = %(sv2)s
)
SELECT
  COALESCE(v1.component_ref, v2.component_ref) AS component_ref,
  COALESCE(v1.pin_name, v2.pin_name) AS pin_name,
  v1.pin_number AS pin_v1,
  v2.pin_number AS pin_v2
FROM v1
FULL OUTER JOIN v2
  ON v1.component_ref = v2.component_ref AND v1.pin_name = v2.pin_name
WHERE v1.pin_number IS DISTINCT FROM v2.pin_number
ORDER BY 1,2;
"""

# Search the code snapshot bound to v2 for literals "pin 5" / "#define UART_TX_PIN 5", show mismatch with HW pin (=6)
MISMATCH_SQL = """
SELECT
  sv2.id AS schematic_version_id,
  cc.id AS commit_id,
  cf.path,
  cc.branch_name,
  cc.commit_sha,
  SUBSTRING(cf.text FROM 'UART_TX_PIN\\s*([0-9]+)')::int AS code_pin,
  p.pin_number AS hw_pin,
  p.component_ref,
  p.pin_name
FROM schematic_code_bindings b
JOIN schematic_versions sv2 ON sv2.id = b.schematic_version_id
JOIN code_commits cc ON cc.id = b.commit_id
JOIN code_files cf ON cf.commit_id = cc.id
LEFT JOIN component_pins p
  ON p.schematic_version_id = sv2.id
 AND p.component_ref = 'U100'
 AND p.pin_name = 'UART_TX'
WHERE b.schematic_version_id = %(sv2)s
  AND cf.text ~ 'UART_TX_PIN\\s*[0-9]+';
"""

# --------------------------
# MAIN
# --------------------------
def main():
    conn = pg_connect()

    # Ensure schemas exist
    schema_mod.ensure_schema(conn)
    code_mod.ensure_code_schema(conn)

    # Load base JSON and fabricate v1/v2 with the deliberate pin change
    base = load_example_json()
    v1, v2 = make_v1_v2(base)

    # Ingest v1
    project_name = v1["analysis"]["metadata"].get("title") or "E2E Project"
    os.makedirs("/tmp/e2e", exist_ok=True)
    v1_path = "/tmp/e2e/schematic_v1.json"
    v2_path = "/tmp/e2e/schematic_v2.json"
    with open(v1_path, "w", encoding="utf-8") as f:
        json.dump(v1, f, ensure_ascii=False, indent=2)
    with open(v2_path, "w", encoding="utf-8") as f:
        json.dump(v2, f, ensure_ascii=False, indent=2)

    # Run the schematic ingest script’s main() via its CLI-like function
    # (or call its internals directly if you prefer)
    # Direct internals approach:
    project_id = schema_mod.get_or_create_project(conn, project_name)
    sv1 = schema_mod.get_or_create_schematic_version(conn, project_id, "v1", v1["analysis"])
    sv2 = schema_mod.get_or_create_schematic_version(conn, project_id, "v2", v2["analysis"])

    # components (1536)
    comps1 = v1["analysis"].get("components", [])
    comps2 = v2["analysis"].get("components", [])
    nets1  = v1["analysis"].get("nets", [])
    nets2  = v2["analysis"].get("nets", [])
    fgs1   = v1["analysis"].get("functional_groups", [])
    fgs2   = v2["analysis"].get("functional_groups", [])

    # Embed & upsert v1
    if comps1:
        ctexts = [schema_mod.build_component_text(c) for c in comps1]
        cembs  = schema_mod.embed_texts(None, ctexts, "text-embedding-3-small")
        rows = []
        for c, e in zip(comps1, cembs):
            rows.append({
                "id": uuid.uuid4(), "schematic_version_id": sv1,
                "reference": c.get("reference"), "value": c.get("value"),
                "description": c.get("description"), "mpn": c.get("mpn"),
                "datasheet": c.get("datasheet"), "footprint": c.get("footprint"),
                "library_id": c.get("library_id"), "rating": c.get("rating"),
                "rotation": c.get("rotation"),
                "position": Json(c.get("position") or {}),
                "embedding": e
            })
        schema_mod.upsert_components(conn, sv1, rows)

    if nets1:
        ntexts = [schema_mod.build_net_text(n) for n in nets1]
        nembs  = schema_mod.embed_texts(None, ntexts, "text-embedding-3-large")
        rows = []
        for n, e in zip(nets1, nembs):
            rows.append({
                "id": uuid.uuid4(), "schematic_version_id": sv1,
                "name": n.get("name"), "net_type": n.get("net_type"),
                "connected_components": n.get("connected_components") or [],
                "connection_points": Json(n.get("connection_points") or []),
                "metadata": Json({k:v for k,v in n.items() if k not in {"name","net_type","connected_components","connection_points"}}),
                "embedding": e
            })
        schema_mod.upsert_nets(conn, sv1, rows)

    if fgs1:
        gtexts = [schema_mod.build_functional_group_text(g) for g in fgs1]
        gembs  = schema_mod.embed_texts(None, gtexts, "text-embedding-3-large")
        rows = []
        for g, e in zip(fgs1, gembs):
            rows.append({
                "id": uuid.uuid4(), "schematic_version_id": sv1,
                "name": g.get("name"), "description": g.get("description"),
                "function": g.get("function"), "components": g.get("components") or [],
                "metadata": Json({k:v for k,v in g.items() if k not in {"name","description","function","components"}}),
                "embedding": e
            })
        schema_mod.upsert_functional_groups(conn, sv1, rows)

    # Derive & store HW facts for v1
    schema_mod.upsert_component_pins(conn, sv1, schema_mod.derive_component_pins(comps1))
    schema_mod.upsert_pin_connections(conn, sv1, schema_mod.derive_pin_connections(nets1))
    schema_mod.upsert_component_models(conn, sv1, schema_mod.derive_component_models(comps1))

    # Embed & upsert v2 (same as above but against sv2)
    if comps2:
        ctexts = [schema_mod.build_component_text(c) for c in comps2]
        cembs  = schema_mod.embed_texts(None, ctexts, "text-embedding-3-small")
        rows = []
        for c, e in zip(comps2, cembs):
            rows.append({
                "id": uuid.uuid4(), "schematic_version_id": sv2,
                "reference": c.get("reference"), "value": c.get("value"),
                "description": c.get("description"), "mpn": c.get("mpn"),
                "datasheet": c.get("datasheet"), "footprint": c.get("footprint"),
                "library_id": c.get("library_id"), "rating": c.get("rating"),
                "rotation": c.get("rotation"),
                "position": Json(c.get("position") or {}),
                "embedding": e
            })
        schema_mod.upsert_components(conn, sv2, rows)

    if nets2:
        ntexts = [schema_mod.build_net_text(n) for n in nets2]
        nembs  = schema_mod.embed_texts(None, ntexts, "text-embedding-3-large")
        rows = []
        for n, e in zip(nets2, nembs):
            rows.append({
                "id": uuid.uuid4(), "schematic_version_id": sv2,
                "name": n.get("name"), "net_type": n.get("net_type"),
                "connected_components": n.get("connected_components") or [],
                "connection_points": Json(n.get("connection_points") or []),
                "metadata": Json({k:v for k,v in n.items() if k not in {"name","net_type","connected_components","connection_points"}}),
                "embedding": e
            })
        schema_mod.upsert_nets(conn, sv2, rows)

    if fgs2:
        gtexts = [schema_mod.build_functional_group_text(g) for g in fgs2]
        gembs  = schema_mod.embed_texts(None, gtexts, "text-embedding-3-large")
        rows = []
        for g, e in zip(fgs2, gembs):
            rows.append({
                "id": uuid.uuid4(), "schematic_version_id": sv2,
                "name": g.get("name"), "description": g.get("description"),
                "function": g.get("function"), "components": g.get("components") or [],
                "metadata": Json({k:v for k,v in g.items() if k not in {"name","description","function","components"}}),
                "embedding": e
            })
        schema_mod.upsert_functional_groups(conn, sv2, rows)

    schema_mod.upsert_component_pins(conn, sv2, schema_mod.derive_component_pins(comps2))
    schema_mod.upsert_pin_connections(conn, sv2, schema_mod.derive_pin_connections(nets2))
    schema_mod.upsert_component_models(conn, sv2, schema_mod.derive_component_models(comps2))

    # ----------------------------
    # Ingest a code snapshot bound to v2
    # ----------------------------
    files = make_code_files_using_pin_5()
    summary = code_mod.ingest_code_snapshot(
        conn,
        project_id=project_id,
        schematic_version_id=sv2,                 # bind code → v2 (HW pin is 6 now)
        repo_uri="https://example.com/repo/fw",
        provider="github",
        branch_name="feature/uart",
        commit_sha=None,
        committed_at=None,
        author="Test Dev <dev@example.com>",
        message="Introduce UART using pin 5",
        files=files,
        embed_batch_size=16,
    )
    print("Code ingest summary:", summary)

    # ----------------------------
    # Vector search sanity check
    # ----------------------------
    qvec = embed_q("usb esd protection")
    net_rows = search_nets_by_text(conn, sv_id=sv2, query_vec=qvec)
    print("\nTop nets (vector search):")
    for r in net_rows:
        print("  ", r)

    # ----------------------------
    # HW diff: pins changed between v1 and v2
    # ----------------------------
    pin_diff = run_sql(conn, PIN_DIFF_SQL, {"sv1": str(sv1), "sv2": str(sv2)})
    print("\nPin diffs v1 → v2:")
    for r in pin_diff:
        print("  ", dict(r))

    # ----------------------------
    # HW↔SW mismatch: code uses 5, HW (v2) is 6
    # ----------------------------
    mismatch = run_sql(conn, MISMATCH_SQL, {"sv2": str(sv2)})
    print("\nCode vs HW pin check:")
    for r in mismatch:
        row = dict(r)
        print("  ", row)
        # Derive a verdict in Python
        if row.get("code_pin") and row.get("hw_pin") and row["code_pin"] != row["hw_pin"]:
            print("   ⚠️ Mismatch detected: code_pin != hw_pin")

    print("\n✅ E2E test completed.")

if __name__ == "__main__":
    main()
