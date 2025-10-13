#!/usr/bin/env python3
"""
test_ingest_and_search.py

Quick E2E test:
- Parse a PDF datasheet into pages + paragraph blocks
- Push to Postgres via push_datasheet(...)
- Run ANN searches for:
  1) "pinouts for GIO/GPIO"
  2) "frequency requirements for available bus systems"
  3) "minimum voltage for available bus systems"

Usage:
  python test_ingest_and_search.py \
      --pdf /path/to/datasheet.pdf \
      --vendor "AcmeSemi" \
      --part "ACM1234" \
      --title "Acme ACM1234 Microcontroller" \
      --dsn "postgresql://user:pass@localhost:5432/dsdb" \
      --profile "default-v1"

Requires:
  pip install psycopg pypdf
Optional:
  - OPENAI_API_KEY set for real 1536-d embeddings (text-embedding-3-small)
"""

from __future__ import annotations
import argparse, os, re, json, uuid
from typing import List, Dict, Any, Optional, Tuple
import psycopg
from pypdf import PdfReader

# --- import your previously provided ingest primitives ---
from datasheet_store import (
    EmbedConfig, TextEmbedder, ImageEmbedder,
    DatasheetIn, PageIn, BlockIn, push_datasheet,
    vector_literal, pad_or_truncate  # reuse utils if exported
)

# ---------- Embedders ----------
class OpenAITextEmbedder(TextEmbedder):
    """
    1536-d embeddings via OpenAI text-embedding-3-small
    """
    def __init__(self, model: str = "text-embedding-3-small", dim: int = 1536):
        self.model = model
        self.dim = dim
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY not set")
        # Lazy import to avoid hard dep if not used
        try:
            from openai import OpenAI  # type: ignore
        except Exception:
            # For the new OpenAI SDKs, adjust import path as needed
            from openai import OpenAI  # noqa: F401
        self.client = OpenAI()

    def embed(self, texts: List[str]) -> List[List[float]]:
        # Batching can be added; keep simple for test
        resp = self.client.embeddings.create(model=self.model, input=texts)
        vecs = [e.embedding for e in resp.data]
        # Ensure correct length (pad/truncate)
        return [pad_or_truncate(v, 1536, True) for v in vecs]


class LocalFallbackTextEmbedder(TextEmbedder):
    """
    Deterministic local 1536-d fallback (not semantically meaningful, but OK for pipeline tests).
    Uses a simple hashing scheme to place weights in a fixed-size vector.
    """
    def __init__(self, dim: int = 1536):
        self.dim = dim

    def _hash_to_index(self, token: str) -> int:
        h = 2166136261
        for ch in token:
            h ^= ord(ch)
            h = (h * 16777619) & 0xFFFFFFFF
        return h % self.dim

    def embed(self, texts: List[str]) -> List[List[float]]:
        out = []
        for t in texts:
            vec = [0.0] * self.dim
            for tok in re.findall(r"[A-Za-z0-9_+-]+", t.lower()):
                idx = self._hash_to_index(tok)
                vec[idx] += 1.0
            # L2 normalize to vaguely mimic embedding scale
            norm = sum(x*x for x in vec) ** 0.5 or 1.0
            out.append([x / norm for x in vec])
        return out


# ---------- Minimal PDF → Pages/Blocks ----------
def pdf_to_pages_blocks(pdf_path: str) -> Tuple[List[PageIn], List[BlockIn], bytes]:
    reader = PdfReader(pdf_path)
    with open(pdf_path, "rb") as f:
        file_bytes = f.read()

    pages: List[PageIn] = []
    blocks: List[BlockIn] = []

    for i, page in enumerate(reader.pages, start=1):
        # pypdf text extraction: rough but fine for this test
        txt = page.extract_text() or ""
        width = int(page.mediabox.width) if page.mediabox else None
        height = int(page.mediabox.height) if page.mediabox else None

        pages.append(PageIn(page_number=i, width_px=width, height_px=height, text_content=txt))

        # naive paragraph split (double newline or long single newline gaps)
        paras = [p.strip() for p in re.split(r"\n\s*\n|(?:\r?\n){2,}", txt) if p.strip()]
        order = 0
        for p in paras:
            blocks.append(BlockIn(
                page_number=i,
                block_type="paragraph",
                bbox=None,  # skipped in test
                text_content=p,
                structured=None,
                image_bytes=None,
                order_index=order
            ))
            order += 1

        # Simple heuristic table detector: lines with many delimiters (| , ; \t)
        lines = [ln.strip() for ln in txt.splitlines() if ln.strip()]
        tab_like = [ln for ln in lines if sum(ln.count(c) for c in "|,;\t") >= 4]
        if len(tab_like) >= 3:
            table_text = "\n".join(tab_like[:50])
            blocks.append(BlockIn(
                page_number=i,
                block_type="paragraph",  # keep as paragraph for this test; your real parser would emit table blocks
                text_content=table_text,
                structured=None,
                order_index=order
            ))

    return pages, blocks, file_bytes


# ---------- Query helpers ----------
def embed_text_query(q: str, text_embedder: TextEmbedder) -> str:
    vec = text_embedder.embed([q])[0]
    return vector_literal(vec)

def top_k_text_chunks_for_query(conn: psycopg.Connection, profile_name: str,
                                datasheet_id: uuid.UUID, qvec_literal: str, k: int = 10):
    """
    Returns [(score, content, page_number)]
    """
    with conn.cursor() as cur:
        cur.execute("""
          WITH prof AS (
            SELECT id FROM embedding_profiles WHERE name = %s
          )
          SELECT
            (e.embedding <=> %s::vector) AS cos_dist,
            c.content,
            p.page_number
          FROM embeddings_text_1536 e
          JOIN prof ON e.profile_id = prof.id
          LEFT JOIN datasheet_chunks c ON e.ref_id = c.id AND e.scope = 'chunk'
          LEFT JOIN datasheet_pages  p ON c.page_id = p.id
          WHERE e.scope = 'chunk' AND c.datasheet_id = %s
          ORDER BY e.embedding <=> %s::vector
          LIMIT %s
        """, (profile_name, qvec_literal, str(datasheet_id), qvec_literal, k))
        return cur.fetchall()

# Light extraction routines for the demo
PIN_RE = re.compile(r"\b(?:GIO|GPIO)\s*([A-Z]?\d{1,2})\b|pin\s*(\d{1,3})", re.IGNORECASE)
FREQ_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*(MHz|kHz|Hz)\b", re.IGNORECASE)
VOLT_RE = re.compile(r"\b(\d+(?:\.\d+)?)\s*V\b", re.IGNORECASE)
BUS_RE = re.compile(r"\b(I2C|SPI|UART|CAN|LIN|PCIe|USB|QSPI|MDIO|I2S)\b", re.IGNORECASE)

def extract_pinouts(snippets: List[str]) -> Dict[str, List[str]]:
    hits: Dict[str, List[str]] = {}
    for s in snippets:
        for m in PIN_RE.finditer(s):
            key = "GPIO" if m.group(1) else "PIN"
            val = m.group(1) or m.group(2)
            if not val: continue
            hits.setdefault(key, []).append(val.upper())
    return hits

def extract_freq_per_bus(snippets: List[str]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for s in snippets:
        buses = set(b.upper() for b in BUS_RE.findall(s))
        freqs = [f"{v} {u}" for (v,u) in FREQ_RE.findall(s)]
        if buses and freqs:
            for b in buses:
                out.setdefault(b, []).extend(freqs)
    return out

def extract_min_voltage_per_bus(snippets: List[str]) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for s in snippets:
        buses = set(b.upper() for b in BUS_RE.findall(s))
        # “min” guard near voltages
        if "min" in s.lower() or "minimum" in s.lower() or "vmin" in s.lower():
            volts = [f"{v} V" for (v,) in VOLT_RE.findall(s)]
            if buses and volts:
                for b in buses:
                    out.setdefault(b, []).extend(volts)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--vendor", default=None)
    ap.add_argument("--part", default=None)
    ap.add_argument("--title", default=None)
    ap.add_argument("--version", default=None)
    ap.add_argument("--revision_date", default=None)
    ap.add_argument("--source_url", default=None)
    ap.add_argument("--mime", default="application/pdf")
    ap.add_argument("--dsn", required=True, help="postgresql://user:pass@host:port/db")
    ap.add_argument("--profile", default="default-v1")
    args = ap.parse_args()

    # Select text embedder (OpenAI if key present; else local fallback)
    key = os.getenv("OPENAI_API_KEY")
    if key:
        text_embedder: TextEmbedder = OpenAITextEmbedder(model="text-embedding-3-small", dim=1536)
        print("Using OpenAI text-embedding-3-small (1536-d)")
    else:
        text_embedder = LocalFallbackTextEmbedder(dim=1536)
        print("Using local fallback embedder (deterministic 1536-d)")

    cfg = EmbedConfig(
        profile_name=args.profile,
        text_model="text-embedding-3-small",
        text_dim=1536,
        make_document_embeddings=True,
        make_page_embeddings=True,
    )

    # Parse PDF
    pages, blocks, file_bytes = pdf_to_pages_blocks(args.pdf)

    # Build DatasheetIn
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
        blocks=blocks,
    )

    # Connect DB
    with psycopg.connect(args.dsn, autocommit=False) as conn:
        # Ingest
        ds_id = push_datasheet(
            d=ds,
            conn=conn,
            cfg=cfg,
            text_embedder=text_embedder,
            image_embedder=None  # not used in this test
        )
        print(f"Ingested datasheet: {ds_id}")

        # --- Queries ---
        queries = {
            "pinouts_gio": "What are the pinouts for GIO or GPIO and their pin numbers?",
            "bus_freq": "What are the frequency requirements for the available bus systems (I2C, SPI, UART, CAN, LIN, USB, QSPI, MDIO, I2S)?",
            "bus_min_voltage": "What is the minimum voltage for the available bus systems (I2C, SPI, UART, CAN, LIN, USB, QSPI, MDIO, I2S)?",
        }

        for label, q in queries.items():
            print("\n"+"="*80)
            print(f"Query [{label}]: {q}")
            qvec = embed_text_query(q, text_embedder)
            rows = top_k_text_chunks_for_query(conn, cfg.profile_name, ds_id, qvec, k=20)
            # rows: [(cos_dist, content, page_number), ...]
            for rank, (dist, content, page) in enumerate(rows[:5], start=1):
                print(f"[{rank}] score={1.0 - float(dist):.4f} page={page}  snippet: {content[:160]!r}")

            # light extraction over top hits
            snippets = [c for _, c, _ in rows]
            if label == "pinouts_gio":
                pins = extract_pinouts(snippets)
                print("Extracted pin candidates:", json.dumps(pins, indent=2))
            elif label == "bus_freq":
                freq = extract_freq_per_bus(snippets)
                print("Extracted bus frequency candidates:", json.dumps(freq, indent=2))
            elif label == "bus_min_voltage":
                vmin = extract_min_voltage_per_bus(snippets)
                print("Extracted bus min voltage candidates:", json.dumps(vmin, indent=2))

        print("\nDone.")

if __name__ == "__main__":
    main()
