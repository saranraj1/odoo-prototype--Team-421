-- =============================================================================
-- Migration 003: User Management & Permission Matrix Table
-- Target: PostgreSQL 13+
-- Author: DealFlow360 Team
-- Problem Statement Reference: Section 4 (Roles & Permission Matrix) & Section 6.1 (Core Data Model)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS app_user (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    odoo_user_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(256) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'REP',
    can_approve_level1 BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve_level2 BOOLEAN NOT NULL DEFAULT FALSE,
    has_portal_access BOOLEAN NOT NULL DEFAULT FALSE,
    company_id BIGINT NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_app_user_role CHECK (role IN ('REP', 'MANAGER', 'FINANCE', 'ADMIN', 'PORTAL'))
);

CREATE INDEX IF NOT EXISTS idx_app_user_odoo_id ON app_user(odoo_user_id);
CREATE INDEX IF NOT EXISTS idx_app_user_email ON app_user(email);
CREATE INDEX IF NOT EXISTS idx_app_user_role ON app_user(role);
CREATE INDEX IF NOT EXISTS idx_app_user_approver_l1 ON app_user(can_approve_level1) WHERE can_approve_level1 = TRUE;
CREATE INDEX IF NOT EXISTS idx_app_user_approver_l2 ON app_user(can_approve_level2) WHERE can_approve_level2 = TRUE;

COMMIT;
