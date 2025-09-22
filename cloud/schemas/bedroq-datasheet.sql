CREATE TABLE datasheets (
    datasheet_id BINARY(16) PRIMARY KEY,
    analyzer_version VARCHAR(32) NOT NULL,
    supplier VARCHAR(64) NOT NULL,
    supplier_group VARCHAR(64) NOT NULL,
    datasheet_source VARCHAR(1024) NOT NULL,
    datasheet_internal_link VARCHAR(1024) NOT NULL,
    result MEDIUMTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL
);

CREATE TABLE datasheet_embeddings (
    embedding_id BINARY(16) PRIMARY KEY,
    datasheet_id BINARY(16) NOT NULL,
    embedding_version INT NOT NULL,
    page_number INT NOT NULL,
    chunk_index INT NOT NULL,
    text_chunk TEXT NOT NULL,
    embedding_vector BLOB NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    FOREIGN KEY (datasheet_id) REFERENCES datasheets(datasheet_id)
);