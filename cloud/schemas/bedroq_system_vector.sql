CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Projects & Sources
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schematic_version_id UUID REFERENCES schematic_versions(id),
  doc_type TEXT,             -- 'circuit_overview' / 'component' / 'functional_group'
  content TEXT,
  metadata JSONB,
  embedding VECTOR(1536)     -- 1536 is enough for doc text
);

CREATE INDEX IF NOT EXISTS project_documents_hnsw
ON project_documents USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops);


-- Schematic snapshots
CREATE TABLE schematic_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  source_id UUID REFERENCES artifact_sources(id),
  version_tag TEXT,                       -- optional, e.g., "v2" or file name
  content_hash TEXT NOT NULL,             -- hash of normalized JSON
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB.                     -- store analysis.metadata + annotations array here
);


CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schematic_version_id UUID REFERENCES schematic_versions(id),
  reference TEXT, 
  value TEXT, 
  description TEXT, 
  mpn TEXT,
  datasheet TEXT, 
  footprint TEXT, 
  library_id TEXT,
  position JSONB, 
  rating TEXT,
  embedding VECTOR(1536),  -- optional; keep 1536 to avoid the 2000-d IVFFlat limit
  UNIQUE (schematic_version_id, reference)
);

CREATE TABLE nets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schematic_version_id UUID REFERENCES schematic_versions(id),
  name TEXT, 
  net_type TEXT,
  connected_components TEXT[],            -- refs like ['U403','J407',...]
  connection_points JSONB,
  metadata JSONB,
  embedding VECTOR(3072)                  -- 3072-D for richer net semantics
);

CREATE TABLE functional_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schematic_version_id UUID REFERENCES schematic_versions(id),
  name TEXT, 
  description TEXT,
  components TEXT[],                      -- refs
  function TEXT,
  components TEXT[],
  metadata JSONB,
  embedding VECTOR(3072)
);

-- One row per physical/nominal pin on a component (MCU, ASIC, etc.)
CREATE TABLE IF NOT EXISTS component_pins (
  schematic_version_id UUID REFERENCES schematic_versions(id),
  component_ref TEXT,          -- e.g. 'U401'
  pin_number INT,              -- numeric index
  pin_name TEXT,               -- e.g. 'PA5' or 'D5'
  bank TEXT,                   -- optional (ports/banks)
  PRIMARY KEY (schematic_version_id, component_ref, COALESCE(pin_name, pin_number::text))
);

-- Actual connection in the schematic snapshot (what net that pin is tied to)
CREATE TABLE IF NOT EXISTS pin_connections (
  schematic_version_id UUID REFERENCES schematic_versions(id),
  component_ref TEXT,
  pin_number INT,
  pin_name TEXT,
  net_name TEXT,
  PRIMARY KEY (schematic_version_id, component_ref, COALESCE(pin_name, pin_number::text))
);

-- Static MCU catalog (from datasheet or CMSIS/SoC DB): which *alternate functions* a pin can take
CREATE TABLE IF NOT EXISTS mcu_pin_function_catalog (
  mcu_model TEXT,          -- e.g. 'STM32F401RCT6' or 'RP2040'
  pin_name TEXT,           -- 'PA5'
  af_code TEXT,            -- e.g. 'AF7', 'ALT0', 'FUNC2'
  function TEXT,           -- 'USART1_TX', 'SPI1_MOSI', 'I2C1_SCL', 'GPIO'
  notes TEXT,
  PRIMARY KEY (mcu_model, pin_name, af_code, function)
);

-- Optional: identify what MCU model a component_ref represents in this schematic version
CREATE TABLE IF NOT EXISTS component_models (
  schematic_version_id UUID REFERENCES schematic_versions(id),
  component_ref TEXT,
  mcu_model TEXT,
  PRIMARY KEY (schematic_version_id, component_ref)
);


/* Fast ANN (cosine over halfvec) for 3072-D */
CREATE INDEX IF NOT EXISTS nets_hnsw_halfvec_cos
ON nets USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE INDEX IF NOT EXISTS fgroups_hnsw_halfvec_cos
ON functional_groups USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

-- Optional (if you embed components): ANN index for 1,536-D
CREATE INDEX IF NOT EXISTS components_hnsw_halfvec_cos
ON components USING hnsw ((embedding::halfvec(1536)) halfvec_cosine_ops);

CREATE TABLE artifact_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  kind TEXT CHECK (kind IN ('schematic','code')),
  uri TEXT,           -- e.g., S3 path for JSON, git remote for code
  metadata JSONB,
  UNIQUE(project_id, kind, uri)
);

-- Versioning / Snapshots
-- Code snapshots (git commits)
CREATE TABLE code_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  source_id UUID REFERENCES artifact_sources(id),
  provider TEXT,                          -- github/gitlab/local
  default_branch TEXT,
  UNIQUE(project_id, source_id)
);

CREATE TABLE code_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id UUID REFERENCES code_repos(id),
  commit_sha TEXT NOT NULL,
  committed_at TIMESTAMPTZ,
  author TEXT, message TEXT,
  UNIQUE(repo_id, commit_sha)
);

-- Structured SW facts extracted from code (HAL calls, devicetree overlays, Arduino/board defines)
CREATE TABLE IF NOT EXISTS code_pin_mux_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commit_id UUID REFERENCES code_commits(id),
  file_id UUID REFERENCES code_files(id),
  component_ref TEXT,         -- which MCU in the schematic (e.g., 'U401') if determinable
  pin_name TEXT,              -- 'PA5' 'PB6' OR board alias if you can map it
  af_code TEXT,               -- 'AF7' / 'ALT0' / library-specific enum
  function TEXT,              -- 'USART1_TX' 'SPI0_MOSI' etc.
  evidence JSONB              -- snippet, line range, parsed node (for traceability)
);

-- Simple numeric pin references still useful (you already had code_pin_refs; keep it and extend)
CREATE TABLE IF NOT EXISTS code_pin_refs (
  commit_id UUID REFERENCES code_commits(id),
  file_id   UUID REFERENCES code_files(id),
  symbol    TEXT,          -- 'UART_TX_PIN' / 'BOARD_TX'
  value_int INT,           -- 5
  context   TEXT,          -- 'uart','serial','spi','gpio'
  PRIMARY KEY (commit_id, file_id, symbol)
);

CREATE TABLE IF NOT EXISTS pin_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schematic_version_id UUID REFERENCES schematic_versions(id),
  commit_id UUID REFERENCES code_commits(id),
  component_ref TEXT,
  pin_name TEXT,                -- 'PA5'
  net_name TEXT,                -- connected net in this schematic
  selected_function TEXT,       -- from code_pin_mux_facts for this commit (if any)
  provenance JSONB,             -- references to both HW & SW rows
  doc TEXT,                     -- synthesized description (see below)
  embedding VECTOR(1536)
);

-- Optional: peripheral-level summaries (UART1/SPI1/I2C1 etc.)
CREATE TABLE IF NOT EXISTS peripheral_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schematic_version_id UUID REFERENCES schematic_versions(id),
  commit_id UUID REFERENCES code_commits(id),
  peripheral TEXT,              -- 'USART1'
  summary TEXT,                 -- e.g. 'USART1: TX=PA6 (Net_42), RX=PA10 (Net_7)...'
  embedding VECTOR(1536)
);
