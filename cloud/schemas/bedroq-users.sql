CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- for gen_random_uuid()

-- Organizations (optional, for multi-tenant systems)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name CITEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (linked to Cognito)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub TEXT UNIQUE NOT NULL,        -- JWT 'sub' from Cognito
  email CITEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membership of users in organizations
CREATE TABLE organization_users (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  invited_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- Roles are defined per organization (dynamic list)
CREATE TABLE roles (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  id              UUID DEFAULT gen_random_uuid(),
  name            CITEXT NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, name)
);              

-- Mapping of organization members to roles
CREATE TABLE user_roles (
  organization_id UUID NOT NULL,
  user_id         UUID NOT NULL,
  role_id         UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, role_id),
  FOREIGN KEY (organization_id, user_id)
    REFERENCES organization_users(organization_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, role_id)
    REFERENCES roles(organization_id, id) ON DELETE CASCADE
);

-- updated_at helpers (optional)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE OR REPLACE FUNCTION seed_default_roles() RETURNS trigger AS $$
BEGIN
  INSERT INTO roles (organization_id, name) VALUES
    (NEW.id, 'owner'),
    (NEW.id, 'admin'),
    (NEW.id, 'manager'),
    (NEW.id, 'user')
  ON CONFLICT (organization_id, name) DO NOTHING;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_seed_roles
AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION seed_default_roles();


CREATE OR REPLACE FUNCTION create_org_with_owner(p_name text, p_owner_user_id uuid)
RETURNS uuid AS $$
DECLARE
  v_org_id uuid;
  v_owner_role_id uuid;
BEGIN
  INSERT INTO organizations (name) VALUES (p_name) RETURNING id INTO v_org_id;

  -- roles are seeded by trigger; fetch the 'owner' role id
  SELECT id INTO v_owner_role_id
  FROM roles
  WHERE organization_id = v_org_id AND name = 'owner';

  -- add membership
  INSERT INTO organization_users (organization_id, user_id)
  VALUES (v_org_id, p_owner_user_id)
  ON CONFLICT DO NOTHING;

  -- grant owner role
  INSERT INTO user_roles (organization_id, user_id, role_id)
  VALUES (v_org_id, p_owner_user_id, v_owner_role_id)
  ON CONFLICT DO NOTHING;

  RETURN v_org_id;
END $$ LANGUAGE plpgsql;

-- Fast lookups by user across orgs
CREATE INDEX IF NOT EXISTS idx_org_users_user ON organization_users(user_id);

-- Fast “what roles does this user have in this org?”
CREATE INDEX IF NOT EXISTS idx_user_roles_user_org ON user_roles(user_id, organization_id);

-- Fast role lookup by name within org
CREATE INDEX IF NOT EXISTS idx_roles_org_name ON roles(organization_id, name);

-- SELECT create_org_with_owner('Acme Corp', '00000000-0000-0000-0000-000000000001'::uuid);


-- Audit logs (tracks logins, changes.)
-- CREATE TABLE audit_logs (
--     id BIGINT AUTO_INCREMENT PRIMARY KEY,
--     user_id BIGINT,
--     action VARCHAR(255),
--     metadata JSON,
--     ip_address VARCHAR(45),
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (user_id) REFERENCES organizations_users(id)
-- );




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