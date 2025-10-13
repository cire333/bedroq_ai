-- Prereqs
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Types (reuse if you already created them)
DO $$ BEGIN
  CREATE TYPE modality_t AS ENUM ('text','image','multimodal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scope_t AS ENUM ('document','page','block','chunk');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========= Core entities (unchanged from your prior design) =========
CREATE TABLE IF NOT EXISTS datasheets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor        TEXT, 
  part_number   TEXT, 
  title         TEXT, 
  version       TEXT,
  revision_date DATE, 
  source_url    TEXT,
  sha256        BYTEA NOT NULL, 
  mime          TEXT, 
  page_count    INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sha256)
);

CREATE TABLE IF NOT EXISTS datasheet_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  datasheet_id  UUID NOT NULL REFERENCES datasheets(id) ON DELETE CASCADE,
  page_number   INT NOT NULL,
  width_px      INT, 
  height_px INT,
  text_content  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (datasheet_id, page_number)
);

CREATE TABLE IF NOT EXISTS datasheet_blocks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  datasheet_id  UUID NOT NULL REFERENCES datasheets(id) ON DELETE CASCADE,
  page_id       UUID NOT NULL REFERENCES datasheet_pages(id) ON DELETE CASCADE,
  block_type    TEXT NOT NULL CHECK (block_type IN
    ('paragraph','table','chart','timing','caption','legend','axis','figure','other')),
  bbox          JSONB,
  text_content  TEXT,
  structured    JSONB,
  image_uri     TEXT,
  content_hash  BYTEA NOT NULL,
  order_index   INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (datasheet_id, content_hash)
);

CREATE TABLE IF NOT EXISTS datasheet_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  datasheet_id  UUID NOT NULL REFERENCES datasheets(id) ON DELETE CASCADE,
  page_id       UUID REFERENCES datasheet_pages(id) ON DELETE CASCADE,
  block_id      UUID REFERENCES datasheet_blocks(id) ON DELETE CASCADE,
  chunk_type    TEXT NOT NULL CHECK (chunk_type IN
   ('paragraph','table-row','table-col','chart-desc','caption','combined','other')),
  content       TEXT NOT NULL,
  metadata      JSONB,
  content_hash  BYTEA NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (datasheet_id, content_hash)
);

CREATE TABLE IF NOT EXISTS embedding_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT UNIQUE NOT NULL,
  description   TEXT,
  params        JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========= Vector buckets with fixed dims & ANN indexes =========
-- Text bucket: 1536 dims
CREATE TABLE IF NOT EXISTS embeddings_text_1536 (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES embedding_profiles(id) ON DELETE SET NULL,
  model         TEXT NOT NULL,       -- e.g., 'text-embedding-3-large'
  model_dim     INT  NOT NULL DEFAULT 1536,
  modality      modality_t NOT NULL DEFAULT 'text',
  scope         scope_t    NOT NULL, -- 'document'|'page'|'block'|'chunk'

  datasheet_id  UUID REFERENCES datasheets(id) ON DELETE CASCADE,
  page_id       UUID REFERENCES datasheet_pages(id) ON DELETE CASCADE,
  block_id      UUID REFERENCES datasheet_blocks(id) ON DELETE CASCADE,
  chunk_id      UUID REFERENCES datasheet_chunks(id) ON DELETE CASCADE,

  CHECK (
    (CASE WHEN datasheet_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN page_id      IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN block_id     IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN chunk_id     IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  ),

  ref_id UUID GENERATED ALWAYS AS (COALESCE(chunk_id, block_id, page_id, datasheet_id)) STORED,
  embedding     vector(1536) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (profile_id, model, scope, ref_id)  -- modality is constant in this table
);

-- ANN index (HNSW + cosine distance)
CREATE INDEX IF NOT EXISTS idx_embeddings_text_1536_hnsw
  ON embeddings_text_1536 USING hnsw (embedding vector_cosine_ops);

-- Image bucket: 768 dims (e.g., SigLIP/CLIP variants)
CREATE TABLE IF NOT EXISTS embeddings_image_768 (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES embedding_profiles(id) ON DELETE SET NULL,
  model         TEXT NOT NULL,       -- e.g., 'siglip-base'
  model_dim     INT  NOT NULL DEFAULT 768,
  modality      modality_t NOT NULL DEFAULT 'image',
  scope         scope_t    NOT NULL,

  datasheet_id  UUID REFERENCES datasheets(id) ON DELETE CASCADE,
  page_id       UUID REFERENCES datasheet_pages(id) ON DELETE CASCADE,
  block_id      UUID REFERENCES datasheet_blocks(id) ON DELETE CASCADE,
  chunk_id      UUID REFERENCES datasheet_chunks(id) ON DELETE CASCADE,

  CHECK (
    (CASE WHEN datasheet_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN page_id      IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN block_id     IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN chunk_id     IS NOT NULL THEN 1 ELSE 0 END)
    = 1
  ),

  ref_id UUID GENERATED ALWAYS AS (COALESCE(chunk_id, block_id, page_id, datasheet_id)) STORED,
  embedding     vector(768) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (profile_id, model, scope, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_image_768_hnsw
  ON embeddings_image_768 USING hnsw (embedding vector_cosine_ops);

-- Optional view to query across buckets in one go (useful for admin/debug)
CREATE OR REPLACE VIEW embeddings_all AS
  SELECT id, profile_id, model, model_dim, modality, scope,
         datasheet_id, page_id, block_id, chunk_id, ref_id, embedding, created_at,
         'text_1536' AS bucket
  FROM embeddings_text_1536
  UNION ALL
  SELECT id, profile_id, model, model_dim, modality, scope,
         datasheet_id, page_id, block_id, chunk_id, ref_id, embedding, created_at,
         'image_768' AS bucket
  FROM embeddings_image_768;

-- Helpful full-text indexes (unchanged)
CREATE INDEX IF NOT EXISTS idx_page_tsv   ON datasheet_pages  USING gin (to_tsvector('english', coalesce(text_content,'')));
CREATE INDEX IF NOT EXISTS idx_block_tsv  ON datasheet_blocks USING gin (to_tsvector('english', coalesce(text_content,'')));
CREATE INDEX IF NOT EXISTS idx_chunk_tsv  ON datasheet_chunks USING gin (to_tsvector('english', content));
