#!/usr/bin/env python3
"""
Natural-language circuit QA over Postgres + pgvector.

- Uses cosine distance with halfvec indexes for 3072-d (nets, functional_groups)
- Optionally searches 1536-d components (if you ingested them)
- Answers questions like:
    "Is there a filter attached to pin 5?"
    "What is the voltage attached to the pull up resistor J5?"
    "USB D+ protection and power lines"

Env:
  OPENAI_API_KEY, DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE)

Indexes (already suggested elsewhere):
  CREATE INDEX ... USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops); -- nets, functional_groups
  CREATE INDEX ... USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops); -- components (if 1536)

python search_vector_schematics.py --ask "What is the Voltage 3.3V or 5V?"
"""

import os
import re
import json
import math
from typing import Any, Dict, List, Tuple, Optional

import psycopg2
import psycopg2.extras
from pgvector.psycopg2 import register_vector
from openai import OpenAI
from psycopg2.extras import Json
from dotenv import load_dotenv

# =========================
# Config / Connections
# =========================
load_dotenv("../../env.dev")

def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    return OpenAI(api_key=api_key)

CLIENT = get_openai_client()

def connect() -> psycopg2.extensions.connection:
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

# =========================
# Embedding helpers
# =========================
def embed_3072(text: str) -> List[float]:
    """OpenAI 3072-d embedding (nets / functional_groups)."""
    r = CLIENT.embeddings.create(model="text-embedding-3-large", input=[text])
    vec = r.data[0].embedding
    return list(vec)

def embed_1536(text: str) -> List[float]:
    """OpenAI 1536-d embedding (components table if you ingested with small model)."""
    r = CLIENT.embeddings.create(model="text-embedding-3-small", input=[text])
    vec = r.data[0].embedding
    return list(vec)

# Optional: unit-normalize if you want consistency across stores
def normalize(v: List[float]) -> List[float]:
    n = math.sqrt(sum(x*x for x in v))
    return [x / n for x in v] if n else v

# =========================
# Vector search primitives (cosine)
# =========================
def vsearch_nets(conn, text: str, k: int = 10) -> List[Tuple]:
    vec = embed_3072(text)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, net_type, connected_components
            FROM nets
            ORDER BY (embedding::halfvec(3072)) <=> ((%s)::vector)::halfvec(3072)
            LIMIT %s;
            """,
            (vec, k),
        )
        return cur.fetchall()

def vsearch_groups(conn, text: str, k: int = 10) -> List[Tuple]:
    vec = embed_3072(text)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, description, components, function
            FROM functional_groups
            ORDER BY (embedding::halfvec(3072)) <=> ((%s)::vector)::halfvec(3072)
            LIMIT %s;
            """,
            (vec, k),
        )
        return cur.fetchall()

def vsearch_components(conn, text: str, k: int = 10) -> List[Tuple]:
    """Only if you ingested components with 1536-d vectors."""
    vec = embed_1536(text)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, reference, value, description, mpn
            FROM components
            ORDER BY (embedding::halfvec(1536)) <=> ((%s)::vector)::halfvec(1536)
            LIMIT %s;
            """,
            (vec, k),
        )
        return cur.fetchall()

# =========================
# Structured graph helpers
# =========================
def nets_for_component(conn, ref: str) -> List[Tuple[str]]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT name FROM nets WHERE %s = ANY(connected_components);",
            (ref,),
        )
        return [r[0] for r in cur.fetchall()]

def components_on_net(conn, net_name: str) -> List[Dict[str, Any]]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT c.reference, c.value, c.description, c.mpn, c.footprint, c.library_id, c.rating
            FROM components c
            JOIN nets n ON c.reference = ANY(n.connected_components)
            WHERE n.name = %s
            ORDER BY c.reference;
            """,
            (net_name,),
        )
        return list(cur.fetchall())

def groups_touching_net(conn, net_name: str) -> List[Tuple]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT fg.id, fg.name, fg.function, fg.components
            FROM functional_groups fg
            JOIN nets n ON n.connected_components && fg.components
            WHERE n.name = %s;
            """,
            (net_name,),
        )
        return cur.fetchall()

def nets_for_resistor(conn, resistor_ref: str) -> List[str]:
    return nets_for_component(conn, resistor_ref)

def rails_on_net(conn, net_name: str) -> List[Tuple[str, str]]:
    """Return (reference, value) for power rails present on the net (e.g., +3V3, +5V, GND)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.reference, c.value
            FROM components c
            JOIN nets n ON c.reference = ANY(n.connected_components)
            WHERE n.name = %s AND c.value IN ('+3V3', '+5V', 'GND');
            """,
            (net_name,),
        )
        return cur.fetchall()

# =========================
# Heuristics XXX This needs a ton of work don't for get to figure this out pins/connections/base functions, floats, through holes, etc. Quite massive
# =========================
REF_RE = re.compile(r"\b([A-Z]{1,3}\d{1,4})\b")  # e.g., J5, R405, U403
PIN_RE = re.compile(r"\bpin\s+(\d{1,3})\b", re.IGNORECASE)

def detect_filter_near_component(conn, ref: str) -> Dict[str, Any]:
    """
    Heuristic: if any net touching 'ref' also contains both a resistor (R*) and a capacitor (C*),
    and a GND rail is present, report a likely RC shunt/noise filter.
    (We cannot confirm series vs. shunt without pin-level connectivity.)
    """
    nets = nets_for_component(conn, ref)
    findings = []
    for net in nets:
        comps = components_on_net(conn, net)
        refs = [c["reference"] for c in comps]
        has_r = any(r.startswith("R") for r in refs)
        has_c = any(c.startswith("C") for c in refs)
        gnd = rails_on_net(conn, net)
        has_gnd = any(v == "GND" for _, v in gnd)
        if (has_r and has_c) or (has_c and has_gnd):
            findings.append({
                "net": net,
                "components": refs,
                "rails": gnd,
                "note": "Likely RC filter (heuristic)"
            })
    return {"ref": ref, "nets_checked": nets, "filter_hits": findings}

def infer_pullup_voltage_for_component(conn, ref: str) -> Dict[str, Any]:
    """
    Heuristic: for the target component 'ref' (e.g., J5), find resistors on the same nets.
    Then inspect all nets those resistors touch; if any includes +3V3/+5V, treat as pull-up voltage.
    """
    candidate_voltages = set()
    nets = nets_for_component(conn, ref)
    details = []

    for net in nets:
        comps = components_on_net(conn, net)
        resistors = [c for c in comps if c["reference"].startswith("R")]
        for r in resistors:
            r_ref = r["reference"]
            r_nets = nets_for_resistor(conn, r_ref)
            v_rails = []
            for rn in r_nets:
                for (rail_ref, rail_val) in rails_on_net(conn, rn):
                    if rail_val in {"+3V3", "+5V"}:
                        candidate_voltages.add(rail_val)
                        v_rails.append((rail_ref, rail_val))
            details.append({"resistor": r_ref, "resistor_nets": r_nets, "rails": v_rails})

    return {
        "component": ref,
        "candidate_pullup_voltages": sorted(candidate_voltages),
        "evidence": details,
    }

# =========================
# NL intent router
# =========================
def answer_question(conn, question: str) -> Dict[str, Any]:
    """
    Minimal NL router:
      - extract component refs (e.g., J5, U403, R405)
      - extract pin numbers (if any)
      - keyword dispatch: 'filter', 'pull up', 'voltage'
      - fallback to semantic searches
    """
    refs = REF_RE.findall(question)
    pin = PIN_RE.findall(question)
    pin_num = pin[0] if pin else None  # captured string, not used structurally (no pin map available)

    q_lower = question.lower()
    wants_filter = "filter" in q_lower
    wants_voltage = "voltage" in q_lower or "pull up" in q_lower or "pull-up" in q_lower

    result: Dict[str, Any] = {"question": question, "refs": refs, "pin": pin_num, "answers": []}

    if wants_filter and refs:
        # Check for filter presence near the referenced component
        for ref in refs:
            result["answers"].append(detect_filter_near_component(conn, ref))

    if wants_voltage and refs:
        # Infer pull-up voltages involving resistors connected to the referenced component
        for ref in refs:
            result["answers"].append(infer_pullup_voltage_for_component(conn, ref))

    # If we still have nothing concrete, do semantic retrieval to guide the user
    if not result["answers"]:
        result["semantic_nets"] = vsearch_nets(conn, question, k=8)
        result["semantic_groups"] = vsearch_groups(conn, question, k=5)
        # If components table has embeddings:
        try:
            result["semantic_components"] = vsearch_components(conn, question, k=8)
        except Exception:
            result["semantic_components"] = []

    # Attach helpful context if a single net is mentioned in results
    return result

# =========================
# CLI python search_vector_schematics.py --ask "Is there a filter attached to pin 5 of J5?" 
# python search_vector_schematics.py --ask "What is the Voltage 3.3V or 5V?"
# =========================
if __name__ == "__main__":
    import argparse
    from pprint import pprint

    parser = argparse.ArgumentParser(description="Natural-language circuit QA")
    parser.add_argument("--ask", required=True, help="Question in natural language")
    args = parser.parse_args()

    conn = connect()
    out = answer_question(conn, args.ask)
    pprint(out, width=110)
