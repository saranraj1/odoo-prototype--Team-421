# -*- coding: utf-8 -*-
"""DealFlow360 — Customer Portal & Security Test Suite.

Verifies:
1. Customer portal counter-offer negotiation submission (dealflow.negotiation record created, status 'submitted', order locked).
2. Customer payload read restrictions (internal margins, standard_price, and dealflow_risk_score strictly excluded).
3. Insecure Direct Object Reference (IDOR) prevention: Customer 1 attempting to view/negotiate Customer 2 quotation receives HTTP 403 Forbidden.
4. Privilege escalation guard: Portal users cannot directly confirm or bypass DealFlow approval rules.
5. Input validation on negotiation submissions (discount bounds, non-existent order handling).
"""

import json
import pytest
from typing import Any, Dict

from dealflow_odoo.constants import (
    APPROVAL_STATE_APPROVED,
    APPROVAL_STATE_DRAFT,
    APPROVAL_STATE_PENDING,
    ERR_AUTHORIZATION,
    ERR_NOT_FOUND,
    ERR_VALIDATION,
)
from dealflow_odoo.controllers.portal import PortalController, request as portal_request
from dealflow_odoo.schemas import AuthorizationError


@pytest.fixture
def portal_controller() -> PortalController:
    """Provides an instance of PortalController."""
    return PortalController()


@pytest.fixture
def portal_users(mock_odoo_env, seed_data) -> Dict[str, Any]:
    """Provides distinct customer portal users and an unauthenticated public user."""
    acme_partner = seed_data["customers"]["acme"]
    beta_partner = seed_data["customers"]["beta"]

    User = mock_odoo_env["res.users"]
    user_acme = User.create({
        "id": 101,
        "name": "Alice Acme",
        "partner_id": acme_partner,
        "groups": {"base.group_portal", "dealflow_odoo.group_dealflow_portal"},
        "is_public": False,
    })
    user_beta = User.create({
        "id": 102,
        "name": "Bob Beta",
        "partner_id": beta_partner,
        "groups": {"base.group_portal", "dealflow_odoo.group_dealflow_portal"},
        "is_public": False,
    })
    user_public = User.create({
        "id": 100,
        "name": "Public Guest",
        "partner_id": None,
        "groups": set(),
        "is_public": True,
    })
    return {
        "acme": user_acme,
        "beta": user_beta,
        "public": user_public,
    }


def set_portal_request(env: Any, user: Any = None, data: Any = None, params: Any = None) -> None:
    """Helper to configure simulated portal HTTP request context."""
    portal_request.env = env
    if env is not None:
        env.user = user
    portal_request.params = params or {}
    if data is not None:
        portal_request.httprequest.data = json.dumps(data).encode("utf-8")
    else:
        portal_request.httprequest.data = b""


class TestPortalSecurity:
    """Test suite covering customer portal authorization, IDOR defenses, and quotation negotiation."""

    def test_portal_unauthenticated_access_blocked(
        self,
        portal_controller: PortalController,
        sample_quotation: Any,
        mock_odoo_env: Any,
        portal_users: Dict[str, Any],
    ):
        """Tests that unauthenticated / public users are denied access with HTTP 401."""
        # 1. Test GET /dealflow/portal/deal/<id> unauthenticated
        set_portal_request(mock_odoo_env, user=portal_users["public"])
        resp_get = portal_controller.portal_get_deal(sample_quotation.id)
        assert resp_get.status_code == 401
        data_get = json.loads(resp_get.data.decode("utf-8"))
        assert data_get["success"] is False
        assert data_get["error"]["code"] == "AUTHENTICATION_REQUIRED"

        # 2. Test POST /dealflow/portal/negotiate unauthenticated
        set_portal_request(
            mock_odoo_env,
            user=portal_users["public"],
            data={"order_id": sample_quotation.id, "requested_discount": 15.0},
        )
        resp_post = portal_controller.portal_submit_negotiation()
        assert resp_post.status_code == 401
        data_post = json.loads(resp_post.data.decode("utf-8"))
        assert data_post["success"] is False
        assert data_post["error"]["code"] == "AUTHENTICATION_REQUIRED"

    def test_portal_read_authorized_customer_success(
        self,
        portal_controller: PortalController,
        sample_quotation: Any,
        mock_odoo_env: Any,
        portal_users: Dict[str, Any],
    ):
        """Tests that the legitimate customer owner can view their quotation."""
        set_portal_request(mock_odoo_env, user=portal_users["acme"])
        resp = portal_controller.portal_get_deal(sample_quotation.id)
        assert resp.status_code == 200

        data = json.loads(resp.data.decode("utf-8"))
        assert data["success"] is True
        payload = data["data"]
        assert payload["order_id"] == sample_quotation.id
        assert payload["customer"]["name"] == "Acme Corp"
        assert payload["pricing"]["amount_untaxed"] == 1700.0
        assert len(payload["lines"]) == 2

    def test_portal_read_strict_margin_and_cost_exclusion(
        self,
        portal_controller: PortalController,
        sample_quotation: Any,
        mock_odoo_env: Any,
        portal_users: Dict[str, Any],
    ):
        """Verifies that internal profit margins, standard costs, and risk scores are STRICTLY EXCLUDED."""
        # Ensure quotation has internal risk score populated
        sample_quotation.dealflow_risk_score = 42.5

        set_portal_request(mock_odoo_env, user=portal_users["acme"])
        resp = portal_controller.portal_get_deal(sample_quotation.id)
        assert resp.status_code == 200

        resp_text = resp.data.decode("utf-8")
        parsed = json.loads(resp_text)

        # 1. Verify risk score is never exposed to customer
        assert "dealflow_risk_score" not in resp_text
        assert "risk_score" not in resp_text

        # 2. Verify line-level margins and standard costs are excluded
        lines = parsed["data"]["lines"]
        assert len(lines) > 0
        for line in lines:
            assert "standard_price" not in line
            assert "cost_price" not in line
            assert "dealflow_cost_price" not in line
            assert "margin" not in line
            assert "margin_percent" not in line
            # Public visible fields must be present
            assert "price_unit" in line
            assert "discount" in line
            assert "price_subtotal" in line

    def test_portal_idor_prevention_on_read(
        self,
        portal_controller: PortalController,
        sample_quotation: Any,
        mock_odoo_env: Any,
        portal_users: Dict[str, Any],
    ):
        """Tests that Customer 2 (Beta) cannot view Customer 1 (Acme) quotation (IDOR defense)."""
        # Acme quotation has ID 1; Beta attempts to access it
        set_portal_request(mock_odoo_env, user=portal_users["beta"])
        resp = portal_controller.portal_get_deal(sample_quotation.id)

        assert resp.status_code == 403
        data = json.loads(resp.data.decode("utf-8"))
        assert data["success"] is False
        assert data["error"]["code"] == ERR_AUTHORIZATION
        assert "Forbidden" in data["error"]["message"]

    def test_portal_submit_negotiation_success(
        self,
        portal_controller: PortalController,
        sample_quotation: Any,
        mock_odoo_env: Any,
        portal_users: Dict[str, Any],
    ):
        """Tests successful submission of a counter-offer by the authorized customer."""
        set_portal_request(
            mock_odoo_env,
            user=portal_users["acme"],
            data={
                "order_id": sample_quotation.id,
                "requested_discount": 22.0,
                "requested_terms": "Net 45 payment terms",
                "customer_note": "Requesting volume discount based on quarterly commitment.",
            },
        )
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 201

        payload = json.loads(resp.data.decode("utf-8"))
        assert payload["success"] is True
        assert "Negotiation request submitted successfully" in payload["message"]

        neg_data = payload["data"]
        assert neg_data["requested_discount"] == 22.0
        assert neg_data["status"] == "submitted"
        assert neg_data["sale_order_locked"] is True
        assert neg_data["sale_order_approval_state"] == APPROVAL_STATE_PENDING

        # Verify dealflow.negotiation record exists in database
        negotiations = mock_odoo_env["dealflow.negotiation"].search([("sale_order_id", "=", sample_quotation.id)])
        assert len(negotiations) >= 1
        created_neg = negotiations[0]
        assert created_neg.requested_discount == 22.0
        assert created_neg.status == "submitted"

        # Verify underlying quotation state in Odoo
        assert sample_quotation.dealflow_locked is True
        assert sample_quotation.dealflow_approval_state == APPROVAL_STATE_PENDING
        assert sample_quotation.state == "draft"  # Customer NEVER confirms order directly

    def test_portal_idor_prevention_on_negotiation(
        self,
        portal_controller: PortalController,
        sample_quotation: Any,
        mock_odoo_env: Any,
        portal_users: Dict[str, Any],
    ):
        """Tests that Customer 2 (Beta) cannot submit a counter-offer on Customer 1 (Acme) quotation."""
        initial_neg_count = len(mock_odoo_env["dealflow.negotiation"].search([("sale_order_id", "=", sample_quotation.id)]))

        set_portal_request(
            mock_odoo_env,
            user=portal_users["beta"],
            data={
                "order_id": sample_quotation.id,
                "requested_discount": 25.0,
                "customer_note": "Malicious tampering attempt",
            },
        )
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 403

        data = json.loads(resp.data.decode("utf-8"))
        assert data["success"] is False
        assert data["error"]["code"] == ERR_AUTHORIZATION
        assert "Forbidden" in data["error"]["message"]

        # Ensure no negotiation record was created
        current_neg_count = len(mock_odoo_env["dealflow.negotiation"].search([("sale_order_id", "=", sample_quotation.id)]))
        assert current_neg_count == initial_neg_count

    def test_portal_privilege_escalation_confirmation_blocked(
        self,
        sample_quotation: Any,
        mock_odoo_env: Any,
        portal_users: Dict[str, Any],
    ):
        """Tests that an external portal customer cannot trigger direct order confirmation."""
        # Lock the quotation as if customer negotiation is pending
        sample_quotation.dealflow_locked = True
        sample_quotation.dealflow_approval_state = APPROVAL_STATE_PENDING

        # Attempting confirmation on a locked quote must raise AuthorizationError
        with pytest.raises(AuthorizationError) as exc_info:
            sample_quotation.action_confirm()

        assert "Order locked pending DealFlow approval" in str(exc_info.value)
        assert sample_quotation.state == "draft"

    def test_portal_negotiation_input_validation(
        self,
        portal_controller: PortalController,
        sample_quotation: Any,
        mock_odoo_env: Any,
        portal_users: Dict[str, Any],
    ):
        """Tests server-side boundary validation on negotiation parameters."""
        # 1. Missing order_id
        set_portal_request(mock_odoo_env, user=portal_users["acme"], data={"requested_discount": 10.0})
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 400
        assert json.loads(resp.data)["error"]["code"] == ERR_VALIDATION

        # 2. Non-existent order_id
        set_portal_request(mock_odoo_env, user=portal_users["acme"], data={"order_id": 99999, "requested_discount": 10.0})
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 404
        assert json.loads(resp.data)["error"]["code"] == ERR_NOT_FOUND

        # 3. Discount > 100%
        set_portal_request(mock_odoo_env, user=portal_users["acme"], data={"order_id": sample_quotation.id, "requested_discount": 120.0})
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 400
        assert json.loads(resp.data)["error"]["code"] == ERR_VALIDATION

        # 4. Negative discount < 0%
        set_portal_request(mock_odoo_env, user=portal_users["acme"], data={"order_id": sample_quotation.id, "requested_discount": -5.0})
        resp = portal_controller.portal_submit_negotiation()
        assert resp.status_code == 400
        assert json.loads(resp.data)["error"]["code"] == ERR_VALIDATION
