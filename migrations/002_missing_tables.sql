-- =============================================================================
-- Migration 002: Missing Tables (Upsell Rules, Subscription Events, Warehouse Config)
-- Target: PostgreSQL 13+
-- Author: Person 1 (DB Architect)
-- =============================================================================

BEGIN;

-- 10. upsell_rule
CREATE TABLE IF NOT EXISTS upsell_rule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_product_id BIGINT NOT NULL,
    suggested_product_id BIGINT NOT NULL,
    min_margin_threshold DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    is_promoted BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    company_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_upsell_margin CHECK (min_margin_threshold >= 0.00 AND min_margin_threshold <= 100.00),
    CONSTRAINT chk_upsell_no_self CHECK (base_product_id != suggested_product_id)
);

CREATE INDEX IF NOT EXISTS idx_upsell_base ON upsell_rule(base_product_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_upsell_promoted ON upsell_rule(is_promoted) WHERE active = TRUE AND is_promoted = TRUE;

-- 11. subscription_event
CREATE TABLE IF NOT EXISTS subscription_event (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
    odoo_subscription_id BIGINT NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    old_plan VARCHAR(128),
    new_plan VARCHAR(128),
    old_quantity INT,
    new_quantity INT,
    billing_cycle VARCHAR(32),
    proration_days_remaining INT,
    proration_total_days INT,
    prorated_amount DECIMAL(10,2),
    credit_note_amount DECIMAL(10,2) DEFAULT 0.00,
    odoo_credit_note_id BIGINT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_sub_event_type CHECK (event_type IN (
        'PLAN_CHANGE', 'QUANTITY_CHANGE', 'CANCELLATION', 'RENEWAL', 'PRORATION_ADJUSTMENT'
    )),
    CONSTRAINT chk_sub_billing_cycle CHECK (billing_cycle IS NULL OR billing_cycle IN (
        'MONTHLY', 'QUARTERLY', 'YEARLY'
    ))
);

CREATE INDEX IF NOT EXISTS idx_sub_event_deal ON subscription_event(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_event_type ON subscription_event(event_type);
CREATE INDEX IF NOT EXISTS idx_sub_event_odoo_sub ON subscription_event(odoo_subscription_id);

-- 12. warehouse_config
CREATE TABLE IF NOT EXISTS warehouse_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    odoo_warehouse_id BIGINT UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    location VARCHAR(256),
    shipping_cost_weight DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    company_id BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_wh_cost_weight CHECK (shipping_cost_weight >= 0.00 AND shipping_cost_weight <= 100.00)
);

CREATE INDEX IF NOT EXISTS idx_wh_config_odoo ON warehouse_config(odoo_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_wh_config_active ON warehouse_config(active) WHERE active = TRUE;

COMMIT;
