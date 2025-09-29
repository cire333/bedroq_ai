CREATE TABLE schematics (
    compoents_id BINARY(16) PRIMARY KEY,
    analyzer_version VARCHAR(32) NOT NULL,
    organization VARCHAR(64) NOT NULL,
    supplier_group VARCHAR(64) NOT NULL,
    schematic_source VARCHAR(512) NOT NULL,
    schematic_source_url VARCHAR(1024) NOT NULL,
    datasheet_internal_link VARCHAR(1024) NOT NULL,
    encoding_link VARCHAR(1024) NOT NULL,
    -- encoding_link_2 VARCHAR(1024) NULL,
    -- result MEDIUMTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL
);