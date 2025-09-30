CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- Projects & Sources
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

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

