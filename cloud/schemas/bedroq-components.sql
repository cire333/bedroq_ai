REATE TABLE components (
    compoents_id BINARY(16) PRIMARY KEY,
    analyzer_version VARCHAR(32) NOT NULL,
    supplier VARCHAR(64) NOT NULL,
    supplier_group VARCHAR(64) NOT NULL,
    datasheet_source VARCHAR(512) NOT NULL,
    datasheet_source_url VARCHAR(1024) NOT NULL,
    datasheet_internal_link VARCHAR(1024) NOT NULL,
    result MEDIUMTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL
);