-- =============================================================================
-- DealFlow360 Seed Data for Governance Engine & Demo Scenarios
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Discount Policies
-- -----------------------------------------------------------------------------
INSERT INTO discount_policy (
    id, name, customer_tier, product_category_id, max_discount_pct, manager_threshold, finance_threshold, minimum_margin_pct, priority, active
) VALUES
('10000000-0000-0000-0000-000000000001', 'Gold Tier - Hardware Policy', 'GOLD', 1, 15.00, 10.00, 15.00, 20.00, 1, true),
('10000000-0000-0000-0000-000000000002', 'Gold Tier - Service Policy', 'GOLD', 2, 10.00, 5.00, 10.00, 15.00, 2, true),
('10000000-0000-0000-0000-000000000003', 'Silver Tier - Hardware Policy', 'SILVER', 1, 10.00, 5.00, 10.00, 25.00, 3, true),
('10000000-0000-0000-0000-000000000004', 'Bronze Tier - General Policy', 'BRONZE', NULL, 5.00, 3.00, 5.00, 30.00, 4, true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Scenario 1: Clean Deal (Low Risk - Score 12)
-- Customer: Acme Corp (Gold), Order: SO-1001
-- -----------------------------------------------------------------------------
INSERT INTO deal (
    id, odoo_sale_order_id, odoo_partner_id, owner_user_id, status, approval_state, health_status, current_risk_score
) VALUES (
    'a1111111-1111-1111-1111-111111111111', 1001, 101, 2, 'APPROVED', 'APPROVED', 'HEALTHY', 12.00
) ON CONFLICT (id) DO NOTHING;

INSERT INTO risk_assessment (
    id, deal_id, risk_score, severity, decision, trigger_type, calculated_at
) VALUES (
    'r1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 12.00, 'LOW', 'AUTO_APPROVED', 'SYSTEM_EVALUATION', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO risk_factor (
    id, risk_assessment_id, factor_type, source_reference, raw_value, weight, contribution, reason
) VALUES 
('f1111111-1111-1111-1111-111111111111', 'r1111111-1111-1111-1111-111111111111', 'DISCOUNT_MARGIN', 'SO-1001', 8.00, 1.00, 8.00, 'Hardware discount 8% is well within Gold 15% ceiling'),
('f1111111-1111-1111-1111-111111111112', 'r1111111-1111-1111-1111-111111111111', 'DELIVERY_RISK', 'WH-MAIN', 4.00, 1.00, 4.00, 'Single warehouse fulfillment available in Main Warehouse')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Scenario 2: High Risk Deal (Score 61 - Finance Approval Required)
-- Customer: Beta Industries (Gold), Order: SO-1042
-- -----------------------------------------------------------------------------
INSERT INTO deal (
    id, odoo_sale_order_id, odoo_partner_id, owner_user_id, status, approval_state, health_status, current_risk_score
) VALUES (
    'a2222222-2222-2222-2222-222222222222', 1042, 102, 2, 'PENDING_APPROVAL', 'PENDING_FINANCE', 'AT_RISK', 61.00
) ON CONFLICT (id) DO NOTHING;

INSERT INTO risk_assessment (
    id, deal_id, risk_score, severity, decision, trigger_type, calculated_at
) VALUES (
    'r2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 61.00, 'HIGH', 'FINANCE_APPROVAL', 'LINE_DISCOUNT_EXCEEDED', NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO risk_factor (
    id, risk_assessment_id, factor_type, source_reference, raw_value, weight, contribution, reason
) VALUES 
('f2222222-2222-2222-2222-222222222221', 'r2222222-2222-2222-2222-222222222222', 'LINE_DISCOUNT_EXCESS', 'Line 2: Setup Service', 18.00, 2.00, 36.00, 'Service discount 18% exceeds Gold 10% ceiling by 8 points'),
('f2222222-2222-2222-2222-222222222222', 'r2222222-2222-2222-2222-222222222222', 'MARGIN_PRESSURE', 'Blended Order', 18.40, 1.50, 15.00, 'Blended margin 18.4% is below 20% floor'),
('f2222222-2222-2222-2222-222222222223', 'r2222222-2222-2222-2222-222222222222', 'STOCK_SPLIT_PENALTY', 'WH-MAIN + EAST', 2.00, 5.00, 10.00, 'Stock split across 2 warehouses required')
ON CONFLICT (id) DO NOTHING;

INSERT INTO approval_request (
    id, deal_id, risk_assessment_id, required_level, sequence, status, requested_at
) VALUES 
('p2222222-2222-2222-2222-222222222221', 'a2222222-2222-2222-2222-222222222222', 'r2222222-2222-2222-2222-222222222222', 'SALES_MANAGER', 1, 'APPROVED', NOW() - INTERVAL '2 hours'),
('p2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'r2222222-2222-2222-2222-222222222222', 'FINANCE', 2, 'PENDING', NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO approval_action (
    id, approval_request_id, actor_user_id, action, reason, created_at
) VALUES (
    'c2222222-2222-2222-2222-222222222221', 'p2222222-2222-2222-2222-222222222221', 3, 'APPROVED', 'Approved by Sales Manager M. Shah due to strategic customer account', NOW() - INTERVAL '1 hour'
) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Scenario 3: Portal Negotiation Loop (Re-approval Invalidation)
-- Customer: Nova Retail (Silver), Order: SO-1088
-- -----------------------------------------------------------------------------
INSERT INTO deal (
    id, odoo_sale_order_id, odoo_partner_id, owner_user_id, status, approval_state, health_status, current_risk_score
) VALUES (
    'a3333333-3333-3333-3333-333333333333', 1088, 103, 2, 'NEGOTIATION', 'PENDING_MANAGER', 'AT_RISK', 52.00
) ON CONFLICT (id) DO NOTHING;

INSERT INTO negotiation_request (
    id, deal_id, odoo_sale_order_id, customer_partner_id, requested_by, status, message, created_at
) VALUES (
    'n3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 1088, 103, 'CUSTOMER', 'PENDING', 'Can we get 22% off extended warranty to match our quarterly budget?', NOW() - INTERVAL '30 minutes'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO negotiation_change (
    id, negotiation_request_id, odoo_sale_order_line_id, field_name, old_value, requested_value
) VALUES (
    'g3333333-3333-3333-3333-333333333333', 'n3333333-3333-3333-3333-333333333333', 501, 'discount', '10.00', '22.00'
) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Scenario 4: Multi-Warehouse Stock Split Plan
-- Customer: Zenith Co, Order: SO-1105 (15 Laptops)
-- -----------------------------------------------------------------------------
INSERT INTO deal (
    id, odoo_sale_order_id, odoo_partner_id, owner_user_id, status, approval_state, health_status, current_risk_score
) VALUES (
    'a4444444-4444-4444-4444-444444444444', 1105, 104, 2, 'FULFILLING', 'APPROVED', 'HEALTHY', 15.00
) ON CONFLICT (id) DO NOTHING;

INSERT INTO fulfillment_plan (
    id, deal_id, odoo_sale_order_id, status, estimated_shipments, estimated_shipping_cost, algorithm_version
) VALUES (
    'm4444444-4444-4444-4444-444444444444', 'a4444444-4444-4444-4444-444444444444', 1105, 'ACCEPTED', 2, 65.00, 'v1.0'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO fulfillment_plan_line (
    id, fulfillment_plan_id, odoo_product_id, odoo_warehouse_id, requested_qty, allocated_qty, backorder_qty, shipping_cost
) VALUES 
('l4444444-4444-4444-4444-444444444441', 'm4444444-4444-4444-4444-444444444444', 72, 1, 15.00, 9.00, 6.00, 40.00),
('l4444444-4444-4444-4444-444444444442', 'm4444444-4444-4444-4444-444444444444', 72, 2, 6.00, 6.00, 0.00, 25.00)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Audit Events Log
-- -----------------------------------------------------------------------------
INSERT INTO audit_event (
    id, deal_id, event_type, actor_type, actor_id, entity_type, entity_id, reason, metadata
) VALUES 
('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'DEAL_CREATED', 'USER', 2, 'deal', 'a1111111-1111-1111-1111-111111111111', 'Quote SO-1001 initialized from Odoo', '{"customer": "Acme Corp", "tier": "Gold"}'::jsonb),
('e2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'APPROVAL_ESCALATED', 'SYSTEM', 0, 'approval_request', 'p2222222-2222-2222-2222-222222222222', 'Risk score 61 exceeded Sales Manager threshold; escalated to Finance', '{"risk_score": 61.00, "level": "FINANCE"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. Warehouse Configurations (Shipping Cost Weights for Auto-Split Optimizer)
-- -----------------------------------------------------------------------------
INSERT INTO warehouse_config (
    id, odoo_warehouse_id, name, location, shipping_cost_weight, is_primary, active
) VALUES
('w0000000-0000-0000-0000-000000000001', 1, 'Main Warehouse', 'Chennai, Tamil Nadu', 1.00, true, true),
('w0000000-0000-0000-0000-000000000002', 2, 'East Depot', 'Kolkata, West Bengal', 1.80, false, true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. Upsell / Cross-Sell Rule Configuration
-- -----------------------------------------------------------------------------
INSERT INTO upsell_rule (
    id, base_product_id, suggested_product_id, min_margin_threshold, is_promoted, active
) VALUES
('u0000000-0000-0000-0000-000000000001', 72, 85, 20.00, true, true),
('u0000000-0000-0000-0000-000000000002', 72, 90, 15.00, false, true),
('u0000000-0000-0000-0000-000000000003', 95, 96, 25.00, true, true)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. Subscription Proration Event (Mid-Cycle Quantity Change)
-- Customer: Acme Corp, Deal SO-1001, Subscription SUB-201
-- Scenario: Scaled from 5 to 8 seats mid-cycle (18 days remaining of 30-day month)
-- -----------------------------------------------------------------------------
INSERT INTO subscription_event (
    id, deal_id, odoo_subscription_id, event_type,
    old_plan, new_plan, old_quantity, new_quantity,
    billing_cycle, proration_days_remaining, proration_total_days,
    prorated_amount, credit_note_amount, reason
) VALUES (
    's0000000-0000-0000-0000-000000000001',
    'a1111111-1111-1111-1111-111111111111', 201, 'QUANTITY_CHANGE',
    'Enterprise Monthly', 'Enterprise Monthly', 5, 8,
    'MONTHLY', 18, 30,
    54.00, 0.00,
    'Customer scaled from 5 to 8 seats; prorated charge = 3 seats x $30/seat x (18/30 days) = $54.00'
) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 10. Upsell / Cross-Sell Recommendations (Rep Workspace Panel)
-- Deal: SO-1001 (Acme Corp), Base Product: Laptop (72)
-- -----------------------------------------------------------------------------
INSERT INTO recommendation (
    id, deal_id, odoo_product_id, recommendation_type, score, margin_delta, reason, source, status
) VALUES
('m1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 85, 'UPSELL', 92.50, 4.20, '85% of enterprise laptop buyers attach 3-Year ProSupport Warranty; boosts margin by +4.2%', 'CO_PURCHASE', 'ACTIVE'),
('m1111111-1111-1111-1111-111111111112', 'a1111111-1111-1111-1111-111111111111', 90, 'CROSS_SELL', 78.00, 2.50, 'Recommended accessory: Thunderbolt 4 Docking Station', 'MARGIN_BOOST', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 11. Deal Health & Anomaly Snapshots (Health Dashboard)
-- Deal: SO-1042 (Beta Industries - High Risk Deal)
-- -----------------------------------------------------------------------------
INSERT INTO deal_health_snapshot (
    id, deal_id, health_status, overall_score, stalled_score, discount_anomaly_score, delivery_risk_score, approval_delay_score, calculated_at
) VALUES
('h2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'AT_RISK', 61.00, 35.00, 72.00, 45.00, 50.00, NOW() - INTERVAL '15 minutes'),
('h1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'HEALTHY', 12.00, 5.00, 10.00, 8.00, 0.00, NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;


