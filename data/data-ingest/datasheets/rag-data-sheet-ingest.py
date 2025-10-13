from __future__ import annotations
import os, json, hashlib, uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Iterable, Optional, Tuple
import psycopg

# ---------------- Embedding interfaces ----------------
class TextEmbedder:
    def embed(self, texts: List[str]) -> List[List[float]]:
        raise NotImplementedError

class ImageEmbedder:
    def embed(self, images: List[bytes]) -> List[List[float]]:
        raise NotImplementedError

# ---------------- Config ----------------
@dataclass
class EmbedConfig:
    profile_name: str = "default-v1"
    text_model: str = "text-embedding-3-large"
    text_dim: int = 1536
    image_model: str = "siglip-base"
    image_dim: int = 768
    max_chars: int = 1800
    overlap: int = 200
    include_paragraphs: bool = True
    include_captions: bool = True
    include_table_rows: bool = True
    include_chart_descriptions: bool = True
    make_page_embeddings: bool = True
    make_document_embeddings: bool = True
    allow_truncate: bool = True  # If an embedding > target dim, truncate instead of raising

# ---------------- Utilities ----------------
def sha256_bytes(b: bytes) -> bytes:
    return hashlib.sha256(b).digest()

def sha256_text(s: str) -> bytes:
    return sha256_bytes(s.encode("utf-8"))

def pad_or_truncate(vec: List[float], dim: int, allow_truncate: bool = True) -> List[float]:
    n = len(vec)
    if n == dim:
        return vec
    if n < dim:
        return vec + [0.0] * (dim - n)
    # n > dim
    if allow_truncate:
        return vec[:dim]
    raise ValueError(f"Embedding length {n} exceeds target dim {dim}")

def vector_literal(vec: List[float]) -> str:
    return "[" + ",".join(str(float(x)) for x in vec) + "]"

def ensure_profile(conn: psycopg.Connection, cfg: EmbedConfig) -> uuid.UUID:
    params = {
        "granularities": [g for g in (
            "document" if cfg.make_document_embeddings else None,
            "page" if cfg.make_page_embeddings else None,
            "block", "chunk"
        ) if g],
        "max_chars": cfg.max_chars,
        "overlap": cfg.overlap,
        "include": {
            "paragraphs": cfg.include_paragraphs,
            "captions": cfg.include_captions,
            "table_rows": cfg.include_table_rows,
            "chart_descriptions": cfg.include_chart_descriptions
        }
    }
    with conn.cursor() as cur:
        cur.execute("""
          INSERT INTO embedding_profiles (name, description, params)
          VALUES (%s, %s, %s)
          ON CONFLICT (name) DO UPDATE SET params = EXCLUDED.params
          RETURNING id
        """, (cfg.profile_name, "Dynamic datasheet profile", json.dumps(params)))
        return cur.fetchone()[0]

def sliding_chunks(text: str, max_chars: int, overlap: int) -> List[str]:
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]
    out, i = [], 0
    while i < len(text):
        out.append(text[i:i+max_chars])
        if i + max_chars >= len(text): break
        i += max(1, max_chars - overlap)
    return out

def chart_to_description(block: Dict[str, Any]) -> str:
    s = block.get("structured") or {}
    btype = (block.get("block_type") or "chart").lower()
    if btype == "timing":
        timescale = s.get("timescale", {}).get("unit", "")
        signals = [sig.get("name","?") for sig in s.get("signals",[])]
        measures = [m.get("name","?") for m in s.get("measures",[])]
        return f"Timing diagram. Timescale unit: {timescale}. Signals: {', '.join(signals)}. Measures: {', '.join(measures)}."
    axes = s.get("axes", {})
    x, y = axes.get("x", {}), axes.get("y", {})
    names = [str(se.get("name","series")) for se in (s.get("series") or [])[:8]]
    return (
        f"Chart type: {s.get('type','unknown')}. "
        f"X axis: {x.get('label','x')} [{x.get('unit','')}], scale={x.get('scale','linear')}. "
        f"Y axis: {y.get('label','y')} [{y.get('unit','')}], scale={y.get('scale','linear')}. "
        f"Series: {', '.join(names)}."
    )

def table_row_lines(block: Dict[str, Any]) -> Iterable[Tuple[str, Dict[str, Any]]]:
    s = block.get("structured") or {}
    headers = s.get("headers") or []
    for r_i, row in enumerate(s.get("rows") or []):
        cells = []
        for c_i, val in enumerate(row):
            key = headers[c_i] if c_i < len(headers) else f"c{c_i}"
            cells.append(f"{key}={val}")
        yield "; ".join(cells), {"row_index": r_i, "headers": headers}

# ---------------- Input models ----------------
@dataclass
class PageIn:
    page_number: int
    width_px: Optional[int] = None
    height_px: Optional[int] = None
    text_content: Optional[str] = None

@dataclass
class BlockIn:
    page_number: int
    block_type: str
    bbox: Optional[Dict[str, Any]] = None
    text_content: Optional[str] = None
    structured: Optional[Dict[str, Any]] = None
    image_bytes: Optional[bytes] = None
    order_index: Optional[int] = None

@dataclass
class DatasheetIn:
    vendor: Optional[str]
    part_number: Optional[str]
    title: Optional[str]
    version: Optional[str]
    revision_date: Optional[str]    # 'YYYY-MM-DD'
    source_url: Optional[str]
    mime: Optional[str]
    file_bytes: bytes
    pages: List[PageIn]
    blocks: List[BlockIn]

# ---------------- Main ingest ----------------
def push_datasheet(
    d: DatasheetIn,
    conn: psycopg.Connection,
    cfg: EmbedConfig,
    text_embedder: TextEmbedder,
    image_embedder: Optional[ImageEmbedder] = None
) -> uuid.UUID:
    profile_id = ensure_profile(conn, cfg)
    file_hash = sha256_bytes(d.file_bytes)

    with conn.transaction():
        # 1) Datasheet upsert
        with conn.cursor() as cur:
            cur.execute("""
              INSERT INTO datasheets (vendor, part_number, title, version, revision_date, source_url, sha256, mime, page_count)
              VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
              ON CONFLICT (sha256) DO UPDATE SET
                vendor=EXCLUDED.vendor, part_number=EXCLUDED.part_number, title=EXCLUDED.title,
                version=EXCLUDED.version, revision_date=EXCLUDED.revision_date, source_url=EXCLUDED.source_url,
                mime=EXCLUDED.mime, page_count=EXCLUDED.page_count, updated_at=now()
              RETURNING id
            """, (d.vendor, d.part_number, d.title, d.version, d.revision_date, d.source_url,
                  file_hash, d.mime, len(d.pages)))
            datasheet_id = cur.fetchone()[0]

        # 2) Pages upsert
        page_id_by_num: Dict[int, uuid.UUID] = {}
        with conn.cursor() as cur:
            for p in d.pages:
                cur.execute("""
                  INSERT INTO datasheet_pages (datasheet_id, page_number, width_px, height_px, text_content)
                  VALUES (%s,%s,%s,%s,%s)
                  ON CONFLICT (datasheet_id, page_number) DO UPDATE SET
                    width_px=EXCLUDED.width_px, height_px=EXCLUDED.height_px, text_content=EXCLUDED.text_content
                  RETURNING id
                """, (datasheet_id, p.page_number, p.width_px, p.height_px, p.text_content))
                page_id_by_num[p.page_number] = cur.fetchone()[0]

        # 3) Blocks upsert + dynamic chunks
        chunks_to_insert: List[Tuple[uuid.UUID, uuid.UUID, uuid.UUID, str, str, Dict[str,Any], bytes]] = []
        block_ids: List[uuid.UUID] = []
        with conn.cursor() as cur:
            for b in d.blocks:
                page_id = page_id_by_num[b.page_number]
                canonical = {
                    "type": b.block_type,
                    "bbox": b.bbox,
                    "text": (b.text_content or "").strip(),
                    "structured": b.structured
                }
                bhash = sha256_text(json.dumps(canonical, sort_keys=True))
                cur.execute("""
                  INSERT INTO datasheet_blocks
                    (datasheet_id, page_id, block_type, bbox, text_content, structured, image_uri, content_hash, order_index)
                  VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                  ON CONFLICT (datasheet_id, content_hash) DO UPDATE SET
                    page_id=EXCLUDED.page_id, block_type=EXCLUDED.block_type, bbox=EXCLUDED.bbox,
                    text_content=EXCLUDED.text_content, structured=EXCLUDED.structured, order_index=EXCLUDED.order_index
                  RETURNING id
                """, (datasheet_id, page_id, b.block_type, json.dumps(b.bbox) if b.bbox else None,
                      b.text_content, json.dumps(b.structured) if b.structured else None,
                      None, bhash, b.order_index))
                block_id = cur.fetchone()[0]
                block_ids.append(block_id)

                # Paragraphs / captions → chunk
                if b.block_type in ("paragraph","caption"):
                    text = (b.text_content or "").strip()
                    if text:
                        for ch in sliding_chunks(text, cfg.max_chars, cfg.overlap):
                            ch_hash = sha256_text(f"{datasheet_id}:{page_id}:{block_id}:{b.block_type}:{ch}")
                            chunks_to_insert.append(
                                (datasheet_id, page_id, block_id, b.block_type, ch, {"block_type": b.block_type}, ch_hash)
                            )

                # Tables → row lines
                if b.block_type == "table" and (b.structured or {}).get("rows"):
                    headers = (b.structured or {}).get("headers") or []
                    for line, meta in table_row_lines({"structured": b.structured}):
                        ch_hash = sha256_text(f"{datasheet_id}:{page_id}:{block_id}:table-row:{line}")
                        chunks_to_insert.append(
                            (datasheet_id, page_id, block_id, "table-row", line, meta, ch_hash)
                        )

                # Charts / timing → textual descriptors
                if b.block_type in ("chart","timing") and b.structured:
                    desc = chart_to_description({"structured": b.structured, "block_type": b.block_type})
                    if desc:
                        ch_hash = sha256_text(f"{datasheet_id}:{page_id}:{block_id}:chart-desc:{desc}")
                        chunks_to_insert.append(
                            (datasheet_id, page_id, block_id, "chart-desc", desc, {"from": b.block_type}, ch_hash)
                        )

        # 4) Insert chunks
        chunk_ids: List[uuid.UUID] = []
        if chunks_to_insert:
            with conn.cursor() as cur:
                for (ds_id, pg_id, bl_id, ctype, content, meta, chash) in chunks_to_insert:
                    cur.execute("""
                      INSERT INTO datasheet_chunks
                        (datasheet_id, page_id, block_id, chunk_type, content, metadata, content_hash)
                      VALUES (%s,%s,%s,%s,%s,%s,%s)
                      ON CONFLICT (datasheet_id, content_hash) DO NOTHING
                      RETURNING id
                    """, (ds_id, pg_id, bl_id, ctype, content, json.dumps(meta) if meta else None, chash))
                    row = cur.fetchone()
                    if row:
                        chunk_ids.append(row[0])

        # ---------------- Embeddings (padded/truncated to fixed dims) ----------------
        # Document text embedding
        if cfg.make_document_embeddings:
            doc_text = " ".join(filter(None, [d.title, d.vendor, d.part_number])).strip()
            if doc_text:
                vec = pad_or_truncate(text_embedder.embed([doc_text])[0], cfg.text_dim, cfg.allow_truncate)
                with conn.cursor() as cur:
                    cur.execute("""
                      INSERT INTO embeddings_text_1536
                        (profile_id, model, model_dim, scope, datasheet_id, embedding)
                      VALUES (%s,%s,%s,'document',%s,%s::vector)
                      ON CONFLICT (profile_id, model, scope, ref_id) DO UPDATE SET embedding = EXCLUDED.embedding
                    """, (profile_id, cfg.text_model, cfg.text_dim, datasheet_id, vector_literal(vec)))

        # Page text embeddings
        if cfg.make_page_embeddings:
            page_payloads = [(p.page_number, (p.text_content or "").strip()) for p in d.pages if (p.text_content or "").strip()]
            if page_payloads:
                vecs = text_embedder.embed([t for _, t in page_payloads])
                vecs = [pad_or_truncate(v, cfg.text_dim, cfg.allow_truncate) for v in vecs]
                with conn.cursor() as cur:
                    for (page_number, _), v in zip(page_payloads, vecs):
                        page_id = page_id_by_num[page_number]
                        cur.execute("""
                          INSERT INTO embeddings_text_1536
                            (profile_id, model, model_dim, scope, page_id, embedding)
                          VALUES (%s,%s,%s,'page',%s,%s::vector)
                          ON CONFLICT (profile_id, model, scope, ref_id) DO UPDATE SET embedding = EXCLUDED.embedding
                        """, (profile_id, cfg.text_model, cfg.text_dim, page_id, vector_literal(v)))

        # Block image embeddings (charts/timing/figures) if crops provided
        if image_embedder:
            image_jobs: List[Tuple[uuid.UUID, bytes]] = []
            for b, block_id in zip(d.blocks, block_ids):
                if b.image_bytes and b.block_type in ("chart","timing","figure"):
                    image_jobs.append((block_id, b.image_bytes))
            if image_jobs:
                vecs = image_embedder.embed([img for _, img in image_jobs])
                vecs = [pad_or_truncate(v, cfg.image_dim, cfg.allow_truncate) for v in vecs]
                with conn.cursor() as cur:
                    for (block_id, _), v in zip(image_jobs, vecs):
                        cur.execute("""
                          INSERT INTO embeddings_image_768
                            (profile_id, model, model_dim, scope, block_id, embedding)
                          VALUES (%s,%s,%s,'block',%s,%s::vector)
                          ON CONFLICT (profile_id, model, scope, ref_id) DO UPDATE SET embedding = EXCLUDED.embedding
                        """, (profile_id, cfg.image_model, cfg.image_dim, block_id, vector_literal(v)))

        # Chunk text embeddings
        with conn.cursor() as cur:
            cur.execute("SELECT id, content FROM datasheet_chunks WHERE datasheet_id = %s ORDER BY created_at DESC", (datasheet_id,))
            rows = cur.fetchall()

        if rows:
            texts = [r[1] for r in rows]
            vecs = text_embedder.embed(texts)
            vecs = [pad_or_truncate(v, cfg.text_dim, cfg.allow_truncate) for v in vecs]
            with conn.cursor() as cur:
                for (chunk_id, _), v in zip(rows, vecs):
                    cur.execute("""
                      INSERT INTO embeddings_text_1536
                        (profile_id, model, model_dim, scope, chunk_id, embedding)
                      VALUES (%s,%s,%s,'chunk',%s,%s::vector)
                      ON CONFLICT (profile_id, model, scope, ref_id) DO UPDATE SET embedding = EXCLUDED.embedding
                    """, (profile_id, cfg.text_model, cfg.text_dim, chunk_id, vector_literal(v)))

    return datasheet_id
