-- =============================================================================
-- Migration 001: Initial Canonical Schema
-- Target: PostgreSQL 13+
-- Author: Person 1 (DB Architect)
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. deal
CREATE TABLE IF NOT EXISTS deal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    odoo_sale_order_id BIGINT UNIQUE NOT NULL,
    odoo_partner_id BIGINT NOT NULL,
    owner_user_id BIGINT NOT NULL,
    company_id BIGINT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    approval_state VARCHAR(32) NOT NULL DEFAULT 'NONE',
    health_status VARCHAR(32) NOT NULL DEFAULT 'HEALTHY',
    current_risk_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_deal_status CHECK (status IN (
        'DRAFT', 'EVALUATED', 'PENDING_APPROVAL', 'APPROVED', 
        'NEGOTIATION', 'REAPPROVAL', 'READY', 'FULFILLING', 'BILLING', 'CLOSED'
    )),
    CONSTRAINT chk_deal_approval_state CHECK (approval_state IN (
        'NONE', 'PENDING_MANAGER', 'PENDING_FINANCE', 'APPROVED', 'REJECTED', 'RETURNED'
    )),
    CONSTRAINT chk_deal_health CHECK (health_status IN (
        'HEALTHY', 'STALLED', 'AT_RISK', 'CRITICAL'
    )),
    CONSTRAINT chk_deal_risk_score CHECK (current_risk_score >= 0.00 AND current_risk_score <= 100.00)
);

CREATE INDEX IF NOT EXISTS idx_deal_odoo_so ON deal(odoo_sale_order_id);
CREATE INDEX IF NOT EXISTS idx_deal_odoo_partner ON deal(odoo_partner_id);
CREATE INDEX IF NOT EXISTS idx_deal_status ON deal(status);
CREATE INDEX IF NOT EXISTS idx_deal_approval_state ON deal(approval_state);
CREATE INDEX IF NOT EXISTS idx_deal_health ON deal(health_status);

-- 2. discount_policy
CREATE TABLE IF NOT EXISTS discount_policy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL,
    company_id BIGINT NOT NULL DEFAULT 1,
    customer_tier VARCHAR(32) NOT NULL,
    product_category_id BIGINT,
    max_discount_pct DECIMAL(5,2) NOT NULL,
    manager_threshold DECIMAL(5,2) NOT NULL,
    finance_threshold DECIMAL(5,2) NOT NULL,
    minimum_margin_pct DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    priority INT NOT NULL DEFAULT 10,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_policy_tier CHECK (customer_tier IN ('BRONZE', 'SILVER', 'GOLD', 'ALL')),
    CONSTRAINT chk_policy_max_disc CHECK (max_discount_pct >= 0.00 AND max_discount_pct <= 100.00),
    CONSTRAINT chk_policy_mgr_thresh CHECK (manager_threshold >= 0.00 AND manager_threshold <= 100.00),
    CONSTRAINT chk_policy_fin_thresh CHECK (finance_threshold >= 0.00 AND finance_threshold <= 100.00),
    CONSTRAINT chk_policy_min_margin CHECK (minimum_margin_pct >= 0.00 AND minimum_margin_pct <= 100.00)
);

CREATE INDEX IF NOT EXISTS idx_policy_tier_cat ON discount_policy(customer_tier, product_category_id);
CREATE INDEX IF NOT EXISTS idx_policy_active_effective ON discount_policy(active, effective_from, effective_to);

-- 3. risk_assessment & risk_factor
CREATE TABLE IF NOT EXISTS risk_assessment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
    risk_score DECIMAL(5,2) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    decision VARCHAR(32) NOT NULL,
    trigger_type VARCHAR(32) NOT NULL DEFAULT 'SYSTEM_EVALUATION',
    policy_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_risk_score CHECK (risk_score >= 0.00 AND risk_score <= 100.00),
    CONSTRAINT chk_risk_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_risk_decision CHECK (decision IN ('AUTO_APPROVED', 'MANAGER_APPROVAL', 'FINANCE_APPROVAL', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_risk_deal_calc ON risk_assessment(deal_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_score ON risk_assessment(risk_score);

CREATE TABLE IF NOT EXISTS risk_factor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    risk_assessment_id UUID NOT NULL REFERENCES risk_assessment(id) ON DELETE CASCADE,
    factor_type VARCHAR(64) NOT NULL,
    source_reference VARCHAR(128),
    raw_value DECIMAL(10,2) NOT NULL,
    weight DECIMAL(5,2) NOT NULL,
    contribution DECIMAL(5,2) NOT NULL,
    reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rf_assessment ON risk_factor(risk_assessment_id);

-- 4. approval_request & approval_action
CREATE TABLE IF NOT EXISTS approval_request (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
    risk_assessment_id UUID NOT NULL REFERENCES risk_assessment(id),
    required_level VARCHAR(32) NOT NULL,
    sequence INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_approval_req_level CHECK (required_level IN ('SALES_MANAGER', 'FINANCE', 'EXEC')),
    CONSTRAINT chk_approval_req_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'INVALIDATED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_approval 
ON approval_request(deal_id, sequence) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_app_req_deal_status ON approval_request(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_app_req_level_status ON approval_request(required_level, status);

CREATE TABLE IF NOT EXISTS approval_action (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_request_id UUID NOT NULL REFERENCES approval_request(id) ON DELETE CASCADE,
    actor_user_id BIGINT NOT NULL,
    action VARCHAR(32) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_approval_action CHECK (action IN ('APPROVED', 'REJECTED', 'RETURNED', 'DELEGATED'))
);

CREATE INDEX IF NOT EXISTS idx_app_action_request ON approval_action(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_app_action_actor ON approval_action(actor_user_id);

-- 5. negotiation_request & negotiation_change
CREATE TABLE IF NOT EXISTS negotiation_request (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
    odoo_sale_order_id BIGINT NOT NULL,
    customer_partner_id BIGINT NOT NULL,
    requested_by VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_neg_status CHECK (status IN ('PENDING', 'ACCEPTED', 'COUNTERED', 'REJECTED', 'EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_neg_req_deal_status ON negotiation_request(deal_id, status);

CREATE TABLE IF NOT EXISTS negotiation_change (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negotiation_request_id UUID NOT NULL REFERENCES negotiation_request(id) ON DELETE CASCADE,
    odoo_sale_order_line_id BIGINT NOT NULL,
    field_name VARCHAR(64) NOT NULL,
    old_value VARCHAR(128) NOT NULL,
    requested_value VARCHAR(128) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_neg_change_request ON negotiation_change(negotiation_request_id);

-- 6. fulfillment_plan & fulfillment_plan_line
CREATE TABLE IF NOT EXISTS fulfillment_plan (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
    odoo_sale_order_id BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PROPOSED',
    estimated_shipments INT NOT NULL DEFAULT 1,
    estimated_shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    algorithm_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_fulfillment_status CHECK (status IN ('PROPOSED', 'ACCEPTED', 'OVERRIDDEN', 'EXECUTED'))
);

CREATE INDEX IF NOT EXISTS idx_ful_plan_deal ON fulfillment_plan(deal_id, status);

CREATE TABLE IF NOT EXISTS fulfillment_plan_line (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fulfillment_plan_id UUID NOT NULL REFERENCES fulfillment_plan(id) ON DELETE CASCADE,
    odoo_product_id BIGINT NOT NULL,
    odoo_warehouse_id BIGINT NOT NULL,
    requested_qty DECIMAL(10,2) NOT NULL,
    allocated_qty DECIMAL(10,2) NOT NULL,
    backorder_qty DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT chk_qty_conservation CHECK (allocated_qty + backorder_qty = requested_qty),
    CONSTRAINT chk_requested_qty_pos CHECK (requested_qty >= 0),
    CONSTRAINT chk_allocated_qty_pos CHECK (allocated_qty >= 0),
    CONSTRAINT chk_backorder_qty_pos CHECK (backorder_qty >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ful_plan_line_plan ON fulfillment_plan_line(fulfillment_plan_id);

-- 7. recommendation
CREATE TABLE IF NOT EXISTS recommendation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
    odoo_product_id BIGINT NOT NULL,
    recommendation_type VARCHAR(32) NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    margin_delta DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'CO_PURCHASE',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dismissed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT chk_rec_type CHECK (recommendation_type IN ('UPSELL', 'CROSS_SELL', 'PROMOTION', 'MARGIN_BOOST')),
    CONSTRAINT chk_rec_status CHECK (status IN ('ACTIVE', 'ACCEPTED', 'DISMISSED'))
);

CREATE INDEX IF NOT EXISTS idx_rec_deal_status ON recommendation(deal_id, status);

-- 8. deal_health_snapshot
CREATE TABLE IF NOT EXISTS deal_health_snapshot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
    health_status VARCHAR(32) NOT NULL,
    overall_score DECIMAL(5,2) NOT NULL,
    stalled_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    discount_anomaly_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    delivery_risk_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    approval_delay_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_health_snap_status CHECK (health_status IN ('HEALTHY', 'STALLED', 'AT_RISK', 'CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_health_deal_calc ON deal_health_snapshot(deal_id, calculated_at DESC);

-- 9. audit_event
CREATE TABLE IF NOT EXISTS audit_event (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deal(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    actor_type VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
    actor_id BIGINT NOT NULL DEFAULT 0,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    before_state JSONB,
    after_state JSONB,
    reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_deal_time ON audit_event(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_event(event_type, created_at DESC);

COMMIT;
