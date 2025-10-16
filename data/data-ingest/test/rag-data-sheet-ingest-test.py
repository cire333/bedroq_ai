#!/usr/bin/env python3
"""
test_ingest_and_search.py

E2E test that:
  - parses a PDF into pages + paragraph blocks (simple baseline)
  - uses EmbedConfig to control dynamic chunking + scopes
  - ingests into Postgres via push_datasheet(...)
  - verifies embeddings exist per-scope for the chosen profile
  - runs ANN cosine search in embeddings_text_1536
  - lightly extracts GPIO pinouts, per-bus frequency, and min voltage

Usage example:
  python rag-data-sheet-ingest-test.py \
    --pdf /path/datasheet.pdf \
    --dsn postgresql://user:pass@localhost:5432/dsdb \
    --vendor "AcmeSemi" --part "ACM1234" --title "Acme MCU" \
    --profile default-v1 \
    --max-chars 1800 --overlap 200 \
    --include-paragraphs --include-captions --include-table-rows --include-chart-descriptions \
    --make-document-embeddings --make-page-embeddings
"""

from __future__ import annotations
import argparse, os, re, json, uuid
from typing import List, Dict, Any, Optional, Tuple
import psycopg
from pypdf import PdfReader
import sys
sys.path.append(os.path.abspath(".."))

# ---- Import ingest code & config from your module ----
from datasheets.rag_data_sheet_ingest import (
    EmbedConfig, TextEmbedder, ImageEmbedder,
    DatasheetIn, PageIn, BlockIn, push_datasheet,
    vector_literal, pad_or_truncate
)

from dotenv import load_dotenv

# Load variables from env.dev file
load_dotenv("../../../env.dev")


print (f"[info] Using OpenAI key: {'set' if os.getenv('OPENAI_API_KEY') else 'NOT SET'}")
print (f"[info] Using DATABASE_URL: {os.getenv('DATABASE_URL', 'NOT SET')}")

# ---------- Embedders ----------
class OpenAITextEmbedder(TextEmbedder):
    """1536-d embeddings via OpenAI text-embedding-3-small."""
    def __init__(self, model: str = "text-embedding-3-small", dim: int = 1536):
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY not set")
        from openai import OpenAI  # lazy import
        self.client = OpenAI()
        self.model = model
        self.dim = dim

    def embed(self, texts: List[str]) -> List[List[float]]:
        resp = self.client.embeddings.create(model=self.model, input=texts)
        vecs = [e.embedding for e in resp.data]
        return [pad_or_truncate(v, self.dim, True) for v in vecs]


class LocalFallbackTextEmbedder(TextEmbedder):
    """Deterministic 1536-d fallback (bag-of-hash). Suitable only for plumbing tests."""
    def __init__(self, dim: int = 1536): self.dim = dim
    def _h(self, token: str) -> int:
        h = 2166136261
        for ch in token:
            h ^= ord(ch); h = (h * 16777619) & 0xFFFFFFFF
        return h % self.dim
    def embed(self, texts: List[str]) -> List[List[float]]:
        out = []
        for t in texts:
            v = [0.0]*self.dim
            for tok in re.findall(r"[A-Za-z0-9_+-]+", t.lower()):
                v[self._h(tok)] += 1.0
            n = (sum(x*x for x in v) ** 0.5) or 1.0
            out.append([x/n for x in v])
        return out

# ---------- Minimal PDF → Pages/Blocks ----------
def pdf_to_pages_blocks(pdf_path: str) -> Tuple[List[PageIn], List[BlockIn], bytes]:
    reader = PdfReader(pdf_path)
    with open(pdf_path, "rb") as f: file_bytes = f.read()

    pages: List[PageIn] = []
    blocks: List[BlockIn] = []

    for i, page in enumerate(reader.pages, start=1):
        txt = page.extract_text() or ""
        width = int(page.mediabox.width) if page.mediabox else None
        height = int(page.mediabox.height) if page.mediabox else None
        pages.append(PageIn(page_number=i, width_px=width, height_px=height, text_content=txt))

        # naive paragraph split
        paras = [p.strip() for p in re.split(r"\n\s*\n|(?:\r?\n){2,}", txt) if p.strip()]
        for order, p in enumerate(paras):
            blocks.append(BlockIn(page_number=i, block_type="paragraph", text_content=p, order_index=order))

    return pages, blocks, file_bytes

# ---------- DB helpers ----------
def get_profile_row(conn: psycopg.Connection, name: str) -> Tuple[uuid.UUID, Dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, params FROM embedding_profiles WHERE name = %s", (name,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"Profile {name!r} not found")
        return row[0], row[1] or {}

def count_embeddings(conn: psycopg.Connection, table: str, profile_id: uuid.UUID,
                     datasheet_id: uuid.UUID, scope: str) -> int:
    q = f"SELECT COUNT(*) FROM {table} WHERE profile_id=%s AND scope=%s AND datasheet_id=%s"
    with conn.cursor() as cur:
        cur.execute(q, (profile_id, scope, datasheet_id))
        return int(cur.fetchone()[0])

def top_k_text_chunks_for_query(conn: psycopg.Connection, profile_name: str,
                                datasheet_id: uuid.UUID, qvec_literal: str, k: int = 10):
    with conn.cursor() as cur:
        cur.execute("""
          WITH prof AS (SELECT id FROM embedding_profiles WHERE name = %s)
          SELECT
            (e.embedding <=> %s::vector) AS cos_dist,
            c.content,
            p.page_number
          FROM embeddings_text_1536 e
          JOIN prof ON e.profile_id = prof.id
          JOIN datasheet_chunks c ON e.ref_id = c.id AND e.scope = 'chunk'
          LEFT JOIN datasheet_pages  p ON c.page_id = p.id
          WHERE c.datasheet_id = %s
          ORDER BY e.embedding <=> %s::vector
          LIMIT %s
        """, (profile_name, qvec_literal, str(datasheet_id), qvec_literal, k))
        return cur.fetchall()

def embed_text_query(q: str, text_embedder: TextEmbedder) -> str:
    return vector_literal(text_embedder.embed([q])[0])

# ---------- Light extraction utilities ----------
PIN_RE  = re.compile(r"\b(?:GIO|GPIO)\s*([A-Z]?\d{1,2})\b|pin\s*(\d{1,3})", re.IGNORECASE)
FREQ_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*(MHz|kHz|Hz)\b", re.IGNORECASE)
VOLT_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*V\b", re.IGNORECASE)
BUS_RE  = re.compile(r"\b(I2C|SPI|UART|CAN|LIN|USB|QSPI|MDIO|I2S)\b", re.IGNORECASE)

def extract_pinouts(snips: List[str]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for s in snips:
        for m in PIN_RE.finditer(s):
            key = "GPIO" if m.group(1) else "PIN"
            val = m.group(1) or m.group(2)
            if val: out.setdefault(key, []).append(val.upper())
    return out

def extract_freq_per_bus(snips: List[str]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for s in snips:
        buses = set(b.upper() for b in BUS_RE.findall(s))
        freqs = [f"{v} {u}" for (v,u) in FREQ_RE.findall(s)]
        if buses and freqs:
            for b in buses: out.setdefault(b, []).extend(freqs)
    return out

def extract_min_voltage_per_bus(snips: List[str]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for s in snips:
        buses = set(b.upper() for b in BUS_RE.findall(s))
        if "min" in s.lower() or "minimum" in s.lower() or "vmin" in s.lower():
            volts = [f"{v} V" for v in VOLT_RE.findall(s)]  # fixed unpacking
            if buses and volts:
                for b in buses:
                    out.setdefault(b, []).extend(volts)
    return out


# ---------- Main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--vendor", default="Test Vendor")
    ap.add_argument("--part", default="TEST1234")
    ap.add_argument("--title", default="Title Missing")
    ap.add_argument("--version", default="version v1.0")
    ap.add_argument("--revision_date", default=None)
    ap.add_argument("--source_url", default=None)
    ap.add_argument("--mime", default="application/pdf")

    # EmbedConfig knobs (exercise API!)
    ap.add_argument("--profile", default="default-v1")
    ap.add_argument("--max-chars", type=int, default=1800)
    ap.add_argument("--overlap", type=int, default=200)
    ap.add_argument("--include-paragraphs", action="store_true")
    ap.add_argument("--include-captions", action="store_true")
    ap.add_argument("--include-table-rows", action="store_true")
    ap.add_argument("--include-chart-descriptions", action="store_true")
    ap.add_argument("--make-document-embeddings", action="store_true")
    ap.add_argument("--make-page-embeddings", action="store_true")

    args = ap.parse_args()

    # Pick text embedder
    if os.getenv("OPENAI_API_KEY"):
        text_embedder: TextEmbedder = OpenAITextEmbedder(model="text-embedding-3-small", dim=1536)
        print("Using OpenAI text-embedding-3-small (1536-d)")
    else:
        text_embedder = LocalFallbackTextEmbedder(dim=1536)
        print("Using local fallback embedder (1536-d)")

    # Build EmbedConfig directly from CLI (this is the API being exercised)
    cfg = EmbedConfig(
        profile_name=args.profile,
        text_model="text-embedding-3-small",
        text_dim=1536,
        image_model="siglip-base",
        image_dim=768,
        max_chars=args.max_chars,
        overlap=args.overlap,
        include_paragraphs=args.include_paragraphs,
        include_captions=args.include_captions,
        include_table_rows=args.include_table_rows,
        include_chart_descriptions=args.include_chart_descriptions,
        make_document_embeddings=args.make_document_embeddings,
        make_page_embeddings=args.make_page_embeddings,
        allow_truncate=True
    )

    # Parse PDF → pages/blocks
    pages, blocks, file_bytes = pdf_to_pages_blocks(args.pdf)

    ds = DatasheetIn(
        vendor=args.vendor,
        part_number=args.part,
        title=args.title or (args.part or os.path.basename(args.pdf)),
        version=args.version,
        revision_date=args.revision_date,
        source_url=args.source_url,
        mime=args.mime,
        file_bytes=file_bytes,
        pages=pages,
        blocks=blocks
    )

    url = os.getenv("DATABASE_URL", "postgresql://ericvalasek:ericeric@localhost:5432/bedroq_vector_data")
    with psycopg.connect(url, autocommit=False) as conn:
        # Ingest using EmbedConfig (this exercises ensure_profile + chunking + scopes)
        ds_id = push_datasheet(ds, conn, cfg, text_embedder=text_embedder, image_embedder=None)
        print(f"\nIngested datasheet id: {ds_id}")

        # Fetch and display the persisted profile params to confirm they match cfg
        profile_id, params = get_profile_row(conn, cfg.profile_name)
        print(f"Profile persisted: id={profile_id}, params=\n{json.dumps(params, indent=2)}")

        # Verify embeddings exist per scope for this profile
        chunk_cnt = count_embeddings(conn, "embeddings_text_1536", profile_id, ds_id, "chunk")
        print(f"Chunk embeddings (text, 1536): {chunk_cnt}")

        if cfg.make_document_embeddings:
            doc_cnt = count_embeddings(conn, "embeddings_text_1536", profile_id, ds_id, "document")
            print(f"Document embeddings (text, 1536): {doc_cnt}")
        else:
            print("Document embeddings disabled via EmbedConfig.")

        if cfg.make_page_embeddings:
            page_cnt = count_embeddings(conn, "embeddings_text_1536", profile_id, ds_id, "page")
            print(f"Page embeddings (text, 1536): {page_cnt}")
        else:
            print("Page embeddings disabled via EmbedConfig.")

        # ---- Run example semantic searches ----
        queries = {
            "pinouts_gio": "What are the pinouts for GIO or GPIO and their pin numbers?",
            "bus_freq": "What are the frequency requirements for the available bus systems (I2C, SPI, UART, CAN, LIN, USB, QSPI, MDIO, I2S)?",
            "bus_min_voltage": "What is the minimum voltage for the available bus systems (I2C, SPI, UART, CAN, LIN, USB, QSPI, MDIO, I2S)?"
        }

        for label, q in queries.items():
            print("\n"+"="*88)
            print(f"Query [{label}]: {q}")
            qvec = embed_text_query(q, text_embedder)
            rows = top_k_text_chunks_for_query(conn, cfg.profile_name, ds_id, qvec, k=20)
            for rank, (dist, content, page) in enumerate(rows[:5], start=1):
                print(f"[{rank}] sim={1.0 - float(dist):.4f}  page={page}  snippet: {content[:160]!r}")

            # Light extraction over returned snippets
            snips = [c for _, c, _ in rows]
            if label == "pinouts_gio":
                print("GPIO/PIN candidates:", json.dumps(extract_pinouts(snips), indent=2))
            elif label == "bus_freq":
                print("Bus frequency candidates:", json.dumps(extract_freq_per_bus(snips), indent=2))
            elif label == "bus_min_voltage":
                print("Bus min voltage candidates:", json.dumps(extract_min_voltage_per_bus(snips), indent=2))

        print("\nDone.")

if __name__ == "__main__":
    main()
