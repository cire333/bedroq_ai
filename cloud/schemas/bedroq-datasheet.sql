-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- Optional enums (feel free to use TEXT if you prefer)
DO $$ BEGIN
  CREATE TYPE modality_t AS ENUM ('text','image','multimodal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scope_t AS ENUM ('document','page','block','chunk');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Root datasheet record (vendor/part/version + file fingerprint)
CREATE TABLE IF NOT EXISTS datasheets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor        TEXT,
  part_number   TEXT,
  title         TEXT,
  version       TEXT,
  revision_date DATE,
  source_url    TEXT,
  sha256        BYTEA NOT NULL,                  -- file content fingerprint
  mime          TEXT,
  page_count    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sha256)
);

-- Per-page metadata and the raw text (for classical keyword search)
CREATE TABLE IF NOT EXISTS datasheet_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  datasheet_id  UUID NOT NULL REFERENCES datasheets(id) ON DELETE CASCADE,
  page_number   INT  NOT NULL,
  width_px      INT,
  height_px     INT,
  text_content  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (datasheet_id, page_number)
);

-- Fine-grained blocks detected by your parser (paragraph/table/chart/timing/caption/etc.)
-- 'structured' holds parsed JSON for tables/charts/timing diagrams.
CREATE TABLE IF NOT EXISTS datasheet_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  datasheet_id  UUID NOT NULL REFERENCES datasheets(id) ON DELETE CASCADE,
  page_id       UUID NOT NULL REFERENCES datasheet_pages(id) ON DELETE CASCADE,
  block_type    TEXT NOT NULL CHECK (block_type IN
                  ('paragraph','table','chart','timing','caption','legend','axis','figure','other')),
  bbox          JSONB,                 -- {x0,y0,x1,y1, units:'px' or normalized 0..1}
  text_content  TEXT,                  -- paragraphs/captions/axis labels/legend text
  structured    JSONB,                 -- tables (cells), charts (axes/series), timing (signals/measures)
  image_uri     TEXT,                  -- optional crop (e.g., s3://bucket/key)
  content_hash  BYTEA NOT NULL,        -- hash of canonicalized content+layout (dedupe)
  order_index   INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (datasheet_id, content_hash)
);

-- Chunks = dynamic text units for embedding (paragraphs, table rows, chart descriptions, etc.)
CREATE TABLE IF NOT EXISTS datasheet_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  datasheet_id  UUID NOT NULL REFERENCES datasheets(id) ON DELETE CASCADE,
  page_id       UUID REFERENCES datasheet_pages(id) ON DELETE CASCADE,
  block_id      UUID REFERENCES datasheet_blocks(id) ON DELETE CASCADE,
  chunk_type    TEXT NOT NULL CHECK (chunk_type IN
                 ('paragraph','table-row','table-col','chart-desc','caption','combined','other')),
  content       TEXT NOT NULL,
  metadata      JSONB,                 -- row/col indices, series names, units, etc.
  content_hash  BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (datasheet_id, content_hash)
);

-- Embedding profiles = how you chunk/what you embed (re-embeddable, model-agnostic)
CREATE TABLE IF NOT EXISTS embedding_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,  -- e.g., 'default-v1'
  description   TEXT,
  params        JSONB,                 -- {granularities:['document','page','block','chunk'], max_chars, overlap, include:{...}}
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Actual embeddings across granularities & modalities
CREATE TABLE IF NOT EXISTS embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES embedding_profiles(id) ON DELETE SET NULL,
  model         TEXT NOT NULL,         -- e.g., 'text-embedding-3-large', 'siglip-base'
  model_dim     INT  NOT NULL,
  modality      modality_t NOT NULL,   -- 'text' or 'image' (or 'multimodal')
  scope         scope_t    NOT NULL,   -- 'document'|'page'|'block'|'chunk'
  datasheet_id  UUID REFERENCES datasheets(id) ON DELETE CASCADE,
  page_id       UUID REFERENCES datasheet_pages(id) ON DELETE CASCADE,
  block_id      UUID REFERENCES datasheet_blocks(id) ON DELETE CASCADE,
  chunk_id      UUID REFERENCES datasheet_chunks(id) ON DELETE CASCADE,

  -- Ensure exactly one scope target is set
  CHECK (
    (CASE WHEN datasheet_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN page_id      IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN block_id     IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN chunk_id     IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  ),

  -- Reference id to make uniqueness simple
  ref_id UUID GENERATED ALWAYS AS (COALESCE(chunk_id, block_id, page_id, datasheet_id)) STORED,
  embedding     vector NOT NULL,       -- pgvector column
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One vector per (model,modality,scope,ref_id) per profile
  UNIQUE (profile_id, model, modality, scope, ref_id)
);

-- Text search helpers (optional but handy)
CREATE INDEX IF NOT EXISTS idx_page_tsv   ON datasheet_pages  USING gin (to_tsvector('english', coalesce(text_content,'')));
CREATE INDEX IF NOT EXISTS idx_block_tsv  ON datasheet_blocks USING gin (to_tsvector('english', coalesce(text_content,'')));
CREATE INDEX IF NOT EXISTS idx_chunk_tsv  ON datasheet_chunks USING gin (to_tsvector('english', content));

-- Vector indexes (choose one; HNSW if pgvector >= 0.5, otherwise IVFFLAT)
-- IVFFLAT (tune lists by data size; requires ANALYZE before good recall)
