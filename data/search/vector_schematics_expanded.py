#!/usr/bin/env python3
"""
Natural-language circuit Q&A over Postgres + pgvector.

Adds:
- Intent detection and slot extraction (refs, nets, pins, rails)
- Connectivity (are A and B connected?) with path proof (bipartite BFS)
- Heuristics: filters near component, pull-up voltage inference
- Power rails for a component / net
- Datasheet, footprint, position, functional groups
- Semantic fallback using cosine ANN (<=> with halfvec_cosine_ops)

Env:
  OPENAI_API_KEY, DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE)

python vector_schematics_expanded.py --ask "What is the Voltage 3.3V or 5V?"
"""

import os, re, math, time, random
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Tuple

import psycopg2, psycopg2.extras
from psycopg2.extras import RealDictCursor
from pgvector.psycopg2 import register_vector
from openai import OpenAI
from openai import RateLimitError
from dotenv import load_dotenv 

# -------------------------
# Connections / adapters
# -------------------------
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

# -------------------------
# Embeddings (with retry + cache)
# -------------------------
_EMBED_CACHE_3072: Dict[str, List[float]] = {}
_EMBED_CACHE_1536: Dict[str, List[float]] = {}

def _embed_with_retry(model: str, text: str, max_retries=6) -> List[float]:
    delay = 0.75
    for attempt in range(max_retries):
        try:
            r = CLIENT.embeddings.create(model=model, input=[text])
            vec = list(r.data[0].embedding)
            return vec
        except RateLimitError:
            time.sleep(delay * (2 ** attempt) + random.uniform(0, 0.4))
    raise RuntimeError("OpenAI embeddings rate-limited after retries.")

def embed_3072(text: str) -> List[float]:
    if text in _EMBED_CACHE_3072:
        return _EMBED_CACHE_3072[text]
    vec = _embed_with_retry("text-embedding-3-large", text)
    _EMBED_CACHE_3072[text] = vec
    return vec

def embed_1536(text: str) -> List[float]:
    if text in _EMBED_CACHE_1536:
        return _EMBED_CACHE_1536[text]
    vec = _embed_with_retry("text-embedding-3-small", text)
    _EMBED_CACHE_1536[text] = vec
    return vec

def normalize(v: List[float]) -> List[float]:
    n = math.sqrt(sum(x*x for x in v))
    return [x/n for x in v] if n else v

# -------------------------
# Vector searches (cosine)
# NOTE: assumes halfvec_cosine_ops indexes exist
# -------------------------
def vsearch_nets(conn, text: str, k: int = 10) -> List[Tuple]:
    vec = embed_3072(text)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, net_type, connected_components
            FROM nets
            ORDER BY (embedding::halfvec(3072)) <=> ((%s)::vector)::halfvec(3072)
            LIMIT %s;
        """, (vec, k))
        return cur.fetchall()

def vsearch_groups(conn, text: str, k: int = 10) -> List[Tuple]:
    vec = embed_3072(text)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, description, components, function
            FROM functional_groups
            ORDER BY (embedding::halfvec(3072)) <=> ((%s)::vector)::halfvec(3072)
            LIMIT %s;
        """, (vec, k))
        return cur.fetchall()

def vsearch_components(conn, text: str, k: int = 10) -> List[Tuple]:
    vec = embed_1536(text)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, reference, value, description, mpn
            FROM components
            ORDER BY (embedding::halfvec(1536)) <=> ((%s)::vector)::halfvec(1536)
            LIMIT %s;
        """, (vec, k))
        return cur.fetchall()

# -------------------------
# Structured graph helpers
# -------------------------
def nets_for_component(conn, ref: str) -> List[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT name FROM nets WHERE %s = ANY(connected_components);", (ref,))
        return [r[0] for r in cur.fetchall()]

def components_on_net(conn, net_name: str) -> List[Dict[str, Any]]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT c.reference, c.value, c.description, c.mpn, c.footprint, c.library_id, c.rating
            FROM components c
            JOIN nets n ON c.reference = ANY(n.connected_components)
            WHERE n.name = %s
            ORDER BY c.reference;
        """, (net_name,))
        return list(cur.fetchall())

def groups_touching_net(conn, net_name: str) -> List[Tuple]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT fg.id, fg.name, fg.function, fg.components
            FROM functional_groups fg
            JOIN nets n ON n.connected_components && fg.components
            WHERE n.name = %s;
        """, (net_name,))
        return cur.fetchall()

def rails_on_net(conn, net_name: str) -> List[Tuple[str, str]]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT c.reference, c.value
            FROM components c
            JOIN nets n ON c.reference = ANY(n.connected_components)
            WHERE n.name = %s AND c.value IN ('+3V3', '+5V', 'GND');
        """, (net_name,))
        return cur.fetchall()

def groups_for_component(conn, ref: str) -> List[Tuple]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, name, function, components
            FROM functional_groups
            WHERE %s = ANY(components);
        """, (ref,))
        return cur.fetchall()

def component_details(conn, ref: str) -> Optional[Dict[str, Any]]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT reference, value, description, mpn, footprint, library_id, rating, position
            FROM components
            WHERE reference = %s
            LIMIT 1;
        """, (ref,))
        row = cur.fetchone()
        return dict(row) if row else None

# -------------------------
# Connectivity (bipartite BFS)
# -------------------------
def connectivity_path(conn, ref_a: str, ref_b: str, max_depth: int = 4) -> Dict[str, Any]:
    """
    BFS over a components↔nets bipartite graph to prove connectivity and return a path.
    Nodes are ("C", ref) or ("N", net_name).
    """
    from collections import deque

    start = ("C", ref_a)
    goal  = ("C", ref_b)
    q = deque([start])
    parents: Dict[Tuple[str,str], Optional[Tuple[str,str]]] = {start: None}
    depths: Dict[Tuple[str,str], int] = {start: 0}

    def neighbors(node: Tuple[str,str]) -> List[Tuple[str,str]]:
        t, name = node
        nbrs = []
        if t == "C":
            for net in nets_for_component(conn, name):
                nbrs.append(("N", net))
        else:  # node is a net
            for c in components_on_net(conn, name):
                nbrs.append(("C", c["reference"]))
        return nbrs

    while q:
        cur = q.popleft()
        if cur == goal:
            break
        if depths[cur] >= max_depth:
            continue
        for nb in neighbors(cur):
            if nb not in parents:
                parents[nb] = cur
                depths[nb]  = depths[cur] + 1
                q.append(nb)

    if goal not in parents:
        return {"connected": False, "path": []}

    # Reconstruct path
    path = []
    cur = goal
    while cur is not None:
        path.append(cur)
        cur = parents[cur]
    path.reverse()
    return {"connected": True, "path": path}

# -------------------------
# Heuristics (filters, pull-ups, power rails)
# -------------------------
def detect_filter_near_component(conn, ref: str) -> Dict[str, Any]:
    nets = nets_for_component(conn, ref)
    hits = []
    for net in nets:
        comps = components_on_net(conn, net)
        refs = [c["reference"] for c in comps]
        has_r = any(r.startswith("R") for r in refs)
        has_c = any(r.startswith("C") for r in refs)
        rails = rails_on_net(conn, net)
        has_gnd = any(v == "GND" for _, v in rails)
        if (has_r and has_c) or (has_c and has_gnd):
            hits.append({"net": net, "components": refs, "rails": rails, "note": "Likely RC filter (heuristic)"})
    return {"ref": ref, "nets_checked": nets, "filter_hits": hits}

def infer_pullup_voltage_for_component(conn, ref: str) -> Dict[str, Any]:
    candidate_voltages = set()
    details = []
    for net in nets_for_component(conn, ref):
        comps = components_on_net(conn, net)
        resistors = [c for c in comps if c["reference"].startswith("R")]
        for r in resistors:
            r_nets = nets_for_component(conn, r["reference"])
            v_rails = []
            for rn in r_nets:
                for (rail_ref, rail_val) in rails_on_net(conn, rn):
                    if rail_val in {"+3V3", "+5V"}:
                        candidate_voltages.add(rail_val)
                        v_rails.append((rail_ref, rail_val))
            details.append({"resistor": r["reference"], "resistor_nets": r_nets, "rails": v_rails})
    return {"component": ref, "candidate_pullup_voltages": sorted(candidate_voltages), "evidence": details}

def power_rails_for_component(conn, ref: str) -> Dict[str, Any]:
    rails = set()
    per_net = []
    for net in nets_for_component(conn, ref):
        rr = rails_on_net(conn, net)
        per_net.append({"net": net, "rails": rr})
        for _, val in rr:
            rails.add(val)
    return {"component": ref, "rails": sorted(rails), "by_net": per_net}

# -------------------------
# Intent parsing
# -------------------------
REF_RE   = re.compile(r"\b([A-Z]{1,3}\d{1,4})\b")      # e.g., U403, R405, J5
NET_RE   = re.compile(r"\bNet_\d+\b", re.IGNORECASE)   # e.g., Net_3
PIN_RE   = re.compile(r"\bpin\s+(\d{1,3})\b", re.IGNORECASE)
RAIL_RE  = re.compile(r"\+3V3|\+5V|GND", re.IGNORECASE)

class Intent(Enum):
    ARE_CONNECTED = auto()
    COMPONENT_NETS = auto()
    NET_COMPONENTS = auto()
    GROUPS_FOR_COMPONENT = auto()
    GROUPS_FOR_NET = auto()
    FILTER_NEAR_COMPONENT = auto()
    PULLUP_FOR_COMPONENT = auto()
    POWER_FOR_COMPONENT = auto()
    DATASHEET_FOR_COMPONENT = auto()
    POSITION_OF_COMPONENT = auto()
    SEMANTIC_LOOKUP = auto()

@dataclass
class Parsed:
    intent: Intent
    refs: List[str] = field(default_factory=list)
    nets: List[str] = field(default_factory=list)
    pins: List[int]  = field(default_factory=list)
    rails: List[str] = field(default_factory=list)
    text: str = ""

def parse_question(q: str) -> Parsed:
    ql = q.lower()
    refs  = REF_RE.findall(q)
    nets  = NET_RE.findall(q)
    pins  = [int(p) for p in PIN_RE.findall(q)]
    rails = RAIL_RE.findall(q)

    # Intent rules (simple but effective)
    if ("connect" in ql or "path" in ql) and len(refs) >= 2:
        return Parsed(Intent.ARE_CONNECTED, refs=refs[:2], text=q)
    if ("which nets" in ql or "what nets" in ql) and refs:
        return Parsed(Intent.COMPONENT_NETS, refs=refs[:1], text=q)
    if ("what components" in ql or "which components" in ql) and nets:
        return Parsed(Intent.NET_COMPONENTS, nets=nets[:1], text=q)
    if "filter" in ql and refs:
        return Parsed(Intent.FILTER_NEAR_COMPONENT, refs=refs[:1], pins=pins, text=q)
    if ("pull up" in ql or "pull-up" in ql or "pullup" in ql) and refs:
        return Parsed(Intent.PULLUP_FOR_COMPONENT, refs=refs[:1], text=q)
    if "voltage" in ql and refs:
        return Parsed(Intent.POWER_FOR_COMPONENT, refs=refs[:1], text=q)
    if ("datasheet" in ql or "mpn" in ql) and refs:
        return Parsed(Intent.DATASHEET_FOR_COMPONENT, refs=refs[:1], text=q)
    if ("position" in ql or "where is" in ql or "coordinates" in ql) and refs:
        return Parsed(Intent.POSITION_OF_COMPONENT, refs=refs[:1], text=q)
    if ("groups" in ql or "functional" in ql) and refs:
        return Parsed(Intent.GROUPS_FOR_COMPONENT, refs=refs[:1], text=q)
    if ("groups" in ql or "functional" in ql) and nets:
        return Parsed(Intent.GROUPS_FOR_NET, nets=nets[:1], text=q)
    # Fallback
    return Parsed(Intent.SEMANTIC_LOOKUP, refs=refs, nets=nets, pins=pins, rails=rails, text=q)

# -------------------------
# Executor
# -------------------------
def answer_question(conn, question: str) -> Dict[str, Any]:
    p = parse_question(question)
    out: Dict[str, Any] = {"question": question, "parsed": p.__dict__, "answer": None}

    if p.intent == Intent.ARE_CONNECTED and len(p.refs) == 2:
        a, b = p.refs[0], p.refs[1]
        out["answer"] = connectivity_path(conn, a, b)
        return out

    if p.intent == Intent.COMPONENT_NETS and p.refs:
        ref = p.refs[0]
        out["answer"] = {"component": ref, "nets": nets_for_component(conn, ref)}
        return out

    if p.intent == Intent.NET_COMPONENTS and p.nets:
        net = p.nets[0]
        out["answer"] = {"net": net, "components": components_on_net(conn, net)}
        return out

    if p.intent == Intent.GROUPS_FOR_COMPONENT and p.refs:
        ref = p.refs[0]
        out["answer"] = {"component": ref, "groups": groups_for_component(conn, ref)}
        return out

    if p.intent == Intent.GROUPS_FOR_NET and p.nets:
        net = p.nets[0]
        out["answer"] = {"net": net, "groups": groups_touching_net(conn, net)}
        return out

    if p.intent == Intent.FILTER_NEAR_COMPONENT and p.refs:
        out["answer"] = detect_filter_near_component(conn, p.refs[0]) | {"pin_note": "pin-level is heuristic unless pin map exists"}
        return out

    if p.intent == Intent.PULLUP_FOR_COMPONENT and p.refs:
        out["answer"] = infer_pullup_voltage_for_component(conn, p.refs[0])
        return out

    if p.intent == Intent.POWER_FOR_COMPONENT and p.refs:
        out["answer"] = power_rails_for_component(conn, p.refs[0])
        return out

    if p.intent == Intent.DATASHEET_FOR_COMPONENT and p.refs:
        info = component_details(conn, p.refs[0]) or {}
        out["answer"] = {"component": p.refs[0], "datasheet": info.get("datasheet"), "mpn": info.get("mpn")}
        return out

    if p.intent == Intent.POSITION_OF_COMPONENT and p.refs:
        info = component_details(conn, p.refs[0]) or {}
        out["answer"] = {"component": p.refs[0], "position": info.get("position"), "footprint": info.get("footprint")}
        return out

    # Fallback: semantic retrieval to guide user
    out["answer"] = {
        "semantic_nets": vsearch_nets(conn, question, k=8),
        "semantic_groups": vsearch_groups(conn, question, k=5),
        "semantic_components": try_vsearch_components(conn, question, k=8),
    }
    return out

def try_vsearch_components(conn, text, k=8):
    try:
        return vsearch_components(conn, text, k=k)
    except Exception:
        return []

# -------------------------
# CLI usage
# -------------------------
if __name__ == "__main__":
    import argparse, pprint
    parser = argparse.ArgumentParser(description="NL circuit Q&A")
    parser.add_argument("--ask", required=True, help="Ask a question in natural language")
    args = parser.parse_args()
    conn = connect()
    resp = answer_question(conn, args.ask)
    pprint.pprint(resp, width=110)
