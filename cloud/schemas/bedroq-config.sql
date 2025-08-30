-- TODO status ENUMs should be moved to a separate table? 

-- Add organization structure
CREATE TABLE organizations (
    org_id BINARY(16) PRIMARY KEY,
    org_name VARCHAR(100) NOT NULL,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User organization relationship mapping
CREATE TABLE user_organizations (
    user_id BINARY(16) NOT NULL,
    org_id BINARY(16) NOT NULL,
    role ENUM('admin', 'manager', 'operator', 'viewer') NOT NULL,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, org_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    INDEX idx_org_users (org_id, role)
);


CREATE TABLE devices (
    device_id BINARY(16) PRIMARY KEY,
    region VARCHAR(32) NOT NULL,
    customer VARCHAR(64) NOT NULL,
    firmware_version BINARY(16),
    current_config_id BINARY(16),
    last_updated_at DATETIME,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    FOREIGN KEY (firmware_version) REFERENCES firmware_versions(firmware_id),
    FOREIGN KEY (current_config_id) REFERENCES configurations(config_id)
);

-- TODO hardware pieces need to make up a device, this is incomaplete now
CREATE TABLE hardwares (
    hardware_id BINARY(16) PRIMARY KEY,
    device_id BINARY(16) NOT NULL,
    hardware_version VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    FOREIGN KEY (device_id) REFERENCES devices(device_id),
    -- UNIQUE KEY uk_hardware_version (hardware_version, device_id)
);

CREATE INDEX idx_device_lookup ON devices(region, customer, firmware_version);

CREATE TABLE firmware_versions (
    firmware_id BINARY(16) PRIMARY KEY,
    firmware_version VARCHAR(32) NOT NULL,
    location_url TEXT, -- Link to firmware binary
    checksum VARCHAR(64), -- SHA256 or similar
    size INT, -- Size in bytes
    description TEXT,
    status ENUM('draft', 'published', 'deprecated', 'archived') DEFAULT 'draft' AFTER config_version,
    published_by BINARY(16),
    released_date DATETIME,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    FOREIGN KEY (published_by) REFERENCES users(user_id)
);

CREATE INDEX idx_device_deployments ON device_config_deployments(device_id, deployed_at);

-- Configuration Set table (parent)
CREATE TABLE configuration_set (
    config_set_id BINARY(16) PRIMARY KEY,
    org_id BINARY(16) AFTER config_id,
    config_set_name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    merged_from JSON,     -- JSON array of config layer paths
    authored_by BINARY(16),
    published_by BINARY(16),
    published_at DATETIME,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    status ENUM('draft', 'published', 'deprecated', 'archived') DEFAULT 'draft' AFTER config_version,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (authored_by) REFERENCES users(user_id),
    FOREIGN KEY (published_by) REFERENCES users(user_id),
    FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    INDEX idx_authored_by (authored_by),
    INDEX idx_published_by (published_by)
);


-- Configurations table (unchanged except removing config_set_id if it was added)
CREATE TABLE configurations (
    config_id BINARY(16) PRIMARY KEY,
    config_version VARCHAR(32) NOT NULL,
    region VARCHAR(32),
    customer VARCHAR(64),
    firmware_version BINARY(16),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    authored_by BINARY(16),
    published_by BINARY(16),
    config_json_url TEXT, -- Link to full JSON in S3 or similar
    binary_blob_url TEXT, -- Link to binary compiled format (CBOR/protobuf)
    status ENUM('draft', 'published', 'deprecated', 'archived') DEFAULT 'draft' AFTER config_version,
    published_at DATETIME,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    FOREIGN KEY (authored_by) REFERENCES users(user_id),
    FOREIGN KEY (firmware_version) REFERENCES firmware_versions(firmware_id),
    FOREIGN KEY (published_by) REFERENCES users(user_id),
    FOREIGN KEY (org_id) REFERENCES organizations(org_id),
    INDEX idx_firmware (firmware_version),
    INDEX idx_authored_by (authored_by),
    INDEX idx_published_by (published_by),
    INDEX idx_org_id (org_id)
    UNIQUE KEY uk_config_version_region_customer (config_version, region, customer)
);

CREATE INDEX idx_config_filters ON configurations(region, customer, firmware_version);

-- Junction table to establish the many-to-many relationship
CREATE TABLE configuration_set_items (
    config_set_id BINARY(16) NOT NULL,
    config_id BINARY(16) NOT NULL,
    position INT UNSIGNED NOT NULL,  -- For ordering configurations within a set
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    added_by BINARY(16),
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    PRIMARY KEY (config_set_id, config_id),  -- Composite primary key
    FOREIGN KEY (config_set_id) REFERENCES configuration_set(config_set_id) ON DELETE CASCADE,
    FOREIGN KEY (config_id) REFERENCES configurations(config_id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(user_id),
    INDEX idx_config_id (config_id)  -- For queries starting from configuration
);

CREATE TABLE device_config_deployments (
    id BINARY(16) PRIMARY KEY,
    config_id BINARY(16),
    device_id BINARY(16),
    deployed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    deleted_by BINARY(16) NULL,
    FOREIGN KEY (config_id) REFERENCES configurations(config_id),
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);


-- Add a configuration to a set:
-- INSERT INTO configuration_set_items (config_set_id, config_id, position, added_by)
-- VALUES (
--     UUID_TO_BIN('config-set-uuid-here', 1), 
--     UUID_TO_BIN('config-uuid-here', 1),
--     1,  -- First position
--     UUID_TO_BIN('user-uuid-here', 1)
-- );


-- Get all configurations in a set (ordered):
-- SELECT 
--     BIN_TO_UUID(c.config_id, 1) AS config_id,
--     c.config_version,
--     c.region,
--     c.customer,
--     csi.position
-- FROM configuration_set_items csi
-- JOIN configurations c ON csi.config_id = c.config_id
-- WHERE csi.config_set_id = UUID_TO_BIN('config-set-uuid-here', 1)
-- ORDER BY csi.position;

-- Get all sets containing a specific configuration:
-- SELECT 
--     BIN_TO_UUID(cs.config_set_id, 1) AS config_set_id,
--     cs.config_set_name,
--     cs.description
-- FROM configuration_set_items csi
-- JOIN configuration_set cs ON csi.config_set_id = cs.config_set_id
-- WHERE csi.config_id = UUID_TO_BIN('config-uuid-here', 1);

-- -- Insert a user
-- INSERT INTO users (id, username, email)
-- VALUES (UUID_TO_BIN(UUID(), 1), 'johndoe', 'john@example.com');

-- -- Get the user's ID to use in an order
-- SET @user_id = (SELECT id FROM users WHERE username = 'johndoe' LIMIT 1);

-- -- Insert an order for that user
-- INSERT INTO orders (id, user_id, order_total)
-- VALUES (UUID_TO_BIN(UUID(), 1), @user_id, 129.99);

-- -- Query to retrieve orders with user information
-- SELECT 
--     BIN_TO_UUID(o.id, 1) AS order_id,
--     BIN_TO_UUID(o.user_id, 1) AS user_id,
--     u.username,
--     u.email,
--     o.order_total,
--     o.order_date,
--     o.status
-- FROM orders o
-- JOIN users u ON o.user_id = u.id
-- ORDER BY o.order_date DESC;