-- Organizations (optional, for multi-tenant systems)
CREATE TABLE organizations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table linked to Cognito users
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cognito_sub VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    organization_id BIGINT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Roles table
CREATE TABLE roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Many-to-many mapping of users to roles
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Permissions table (optional but helpful for fine-grained access)
CREATE TABLE permissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- Map permissions to roles
CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Audit logs (tracks logins, changes.)
CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(255),
    metadata JSON,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);


-- Role and Permission Granularity May Not Scale
-- Issue: Flat role-permission mapping limits flexibility for complex systems (e.g., project-level roles, dynamic policies).

-- Impact: Hard to enforce fine-grained access control (e.g., per-resource or per-tenant).

-- Fix:

-- Introduce scopes or resource ownership tables.

-- Consider attribute-based access control (ABAC) or hybrid RBAC+ABAC model.

-- 3. Lack of Tenant Isolation (for Large Multi-Tenant Systems)
-- Issue: All tenants share one users table. No hard barriers.

-- Impact: Security risk & noisy neighbor effects. Also harder to shard by tenant.

-- Fix:

-- Add a composite primary key with organization_id in major tables.

-- In extreme scale, consider schema-per-tenant or database-per-tenant models.

-- Use Row-Level Security (RLS) or access-control middleware for data access filtering.

-- 4. Sharding Challenges
-- Issue: Auto-increment ids make horizontal sharding hard.

-- Impact: Difficult to split tables by range or region.

-- Fix:

-- Switch to UUIDs for id fields (especially for users, roles, permissions).

-- Or use snowflake ID generators (globally unique, ordered IDs).

-- 5. Scalability of audit_logs
-- Issue: High write frequency table. Can grow quickly.

-- Impact: Slows down over time, affects write IOPS.

-- Fix:

-- Partition audit_logs by time (e.g., monthly).

-- Archive old logs to cold storage (e.g., S3 via ETL).

-- Avoid foreign keys here for high-speed inserts; use logical consistency.

-- 6. No Tracking of Role Scope or Resource Context
-- Issue: Can't represent “Admin for Project A” and “Viewer for Project B”.

-- Impact: Difficult to support per-resource access control.

-- Fix:

-- Introduce a resource_type and resource_id to user_roles.

-- Or use a scoped user_permissions table for explicit grants.

-- 7. Globalization & SSO Provider Mapping
-- Issue: cognito_sub might not be universal across identity providers in the future.

-- Impact: Harder to manage identity links (e.g., same user logs in via Google & GitHub).

-- Fix:

-- Create a user_identities table with:

-- sql
-- Copy
-- Edit
-- provider_name VARCHAR, provider_user_id VARCHAR, user_id FK
-- Normalize identities across providers into a single internal user.