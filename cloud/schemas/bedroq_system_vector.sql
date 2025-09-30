CREATE EXTENSION IF NOT EXISTS vector;


CREATE TABLE components (
    id UUID PRIMARY KEY,
    reference TEXT,
    value TEXT,
    description TEXT,
    mpn TEXT,
    datasheet TEXT,
    position JSONB,
    embedding VECTOR(1536) -- must match model dimension
);

CREATE TABLE nets (
    id UUID PRIMARY KEY,
    name TEXT,
    net_type TEXT,
    connected_components TEXT[],
    embedding VECTOR(3072)
);

CREATE TABLE functional_groups (
    id UUID PRIMARY KEY,
    name TEXT,
    description TEXT,
    components TEXT[],
    embedding VECTOR(3072)
);
