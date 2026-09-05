# -*- coding: utf-8 -*-
"""DealFlow360 — Full System 4-Workstream Integration Test Suite.

Validates the complete end-to-end integration across all 4 engineering workstreams:
- Agent 1: Decision Engine Data & Repositories (db/, repositories/)
- Agent 2: Odoo ERP Transactions & Adapters (dealflow_odoo/)
- Agent 3: Deal Guardian Governance Engine & FastAPI Gateway (backend/app/)
- Agent 4: Frontend API Contracts & Client DTOs (frontend/src/services/)
"""

import json
import pytest
from typing import Any, Dict

from fastapi.testclient import TestClient

from dealflow_odoo.controllers.api import DealFlowApiController
from dealflow_odoo.controllers.portal import PortalController
import dealflow_odoo.controllers.api as api_module
import dealflow_odoo.controllers.portal as portal_module
from dealflow_odoo.security.security_utils import generate_approval_token
from dealflow_odoo.services.integration_service import OdooIntegrationService
from dealflow_odoo.services.governance_adapter import GovernanceAdapter, dto_to_deal_context
from backend.app.main import app as fastapi_gateway
from backend.app.governance.guardian import DealGuardian
from backend.app.governance.context import DealContext


class MockReq:
    def __init__(self, headers=None, params=None, data=None, env=None):
        self.env = env
        self.params = params or {}
        raw_bytes = json.dumps(data).encode("utf-8") if data is not None else b""
        self.httprequest = type("HttpReq", (), {
            "headers": headers or {},
            "environ": {},
            "data": raw_bytes,
        })()

    def get_json_data(self):
        if self.httprequest.data:
            try:
                return json.loads(self.httprequest.data.decode("utf-8"))
            except Exception:
                return {}
        return self.params

    def make_json_response(self, data, status=200):
        return type(
            "Resp",
            (),
            {
                "status_code": status,
                "data": json.dumps(data).encode("utf-8"),
                "json": data,
                "get_data": lambda as_text=True: json.dumps(data),
            },
        )()


@pytest.fixture
def test_setup(mock_odoo_env, sample_quotation):
    service = OdooIntegrationService(env=mock_odoo_env)
    DealFlowApiController.set_service_override(service)
    DealFlowApiController.set_enforce_auth_in_test(True)
    DealFlowApiController.set_api_key("integration_secret_token")
    client = TestClient(fastapi_gateway)
    yield mock_odoo_env, service, sample_quotation, client
    DealFlowApiController.set_service_override(None)
    DealFlowApiController.set_enforce_auth_in_test(False)


def test_full_cross_workstream_lifecycle(test_setup, monkeypatch):
    """Executes the complete commercial lifecycle across Odoo, Guardian, Gateway, and Repositories."""
    env, service, quotation, client = test_setup
    api_ctrl = DealFlowApiController()
    portal_ctrl = PortalController()

    # -------------------------------------------------------------------------
    # 1. READ ODOO DEAL CONTEXT (Person 2 -> Person 3 contract)
    # -------------------------------------------------------------------------
    context_dto = service.get_deal_context(quotation.id)
    assert context_dto.order_id == quotation.id
    assert len(context_dto.lines) >= 1
    assert context_dto.customer.id == quotation.partner_id.id

    # -------------------------------------------------------------------------
    # 2. CONVERT DTO TO DEAL CONTEXT (Person 2 <-> Person 3 mapping)
    # -------------------------------------------------------------------------
    deal_context = dto_to_deal_context(context_dto)
    assert isinstance(deal_context, DealContext)
    assert deal_context.odoo_sale_order_id == quotation.id
    assert deal_context.customer.odoo_partner_id == quotation.partner_id.id

    # -------------------------------------------------------------------------
    # 3. DIRECT DEAL GUARDIAN EVALUATION (Person 3 Engine)
    # -------------------------------------------------------------------------
    guardian = DealGuardian()
    evaluation = guardian.evaluate_deal(deal_context)
    assert evaluation.deal_id == deal_context.deal_id
    assert evaluation.risk.score >= 0
    assert evaluation.next_best_action is not None
    assert evaluation.fulfillment.total_requested_qty > 0

    # -------------------------------------------------------------------------
    # 4. ODOO INTEGRATION SERVICE EVALUATION & FIELD SYNC (Person 2 <-> Person 3)
    # -------------------------------------------------------------------------
    eval_dict = service.evaluate_deal(quotation.id)
    assert eval_dict["deal_id"] == deal_context.deal_id
    assert "risk" in eval_dict
    assert "approval" in eval_dict
    # Verify Odoo order fields were updated
    assert quotation.dealflow_risk_score == float(evaluation.risk.score)

    # -------------------------------------------------------------------------
    # 5. FASTAPI DECISION ENGINE GATEWAY ROUTE (Person 3 Gateway)
    # -------------------------------------------------------------------------
    gateway_resp = client.post(
        "/api/governance/evaluate",
        json=deal_context.model_dump(),
    )
    assert gateway_resp.status_code == 200
    gw_data = gateway_resp.json()
    assert gw_data["deal_id"] == deal_context.deal_id
    assert "risk" in gw_data
    assert "next_best_action" in gw_data

    # -------------------------------------------------------------------------
    # 6. REST CONTROLLER EVALUATE ENDPOINT (Person 2 API)
    # -------------------------------------------------------------------------
    req = MockReq(
        headers={"Authorization": "Bearer integration_secret_token"},
        env=env,
    )
    monkeypatch.setattr(api_module, "request", req)
    api_eval_resp = api_ctrl.evaluate_order(quotation.id)
    assert api_eval_resp.status_code == 200
    assert api_eval_resp.json["success"] is True
    assert "risk" in api_eval_resp.json["data"]

    # -------------------------------------------------------------------------
    # 7. MULTI-WAREHOUSE FULFILLMENT SPLIT ALLOCATION (Person 3 -> Person 2)
    # -------------------------------------------------------------------------
    fulfillment_payload = {
        "plan": {
            "allocations": [
                {
                    "product_id": quotation.order_line[0].product_id.id,
                    "warehouse_id": 1,
                    "warehouse_name": "Main Warehouse",
                    "quantity": float(quotation.order_line[0].product_uom_qty),
                }
            ]
        }
    }
    req_ful = MockReq(
        headers={"Authorization": "Bearer integration_secret_token"},
        data=fulfillment_payload,
        env=env,
    )
    monkeypatch.setattr(api_module, "request", req_ful)
    ful_resp = api_ctrl.apply_fulfillment(quotation.id)
    assert ful_resp.status_code == 200
    assert ful_resp.json["success"] is True

    # -------------------------------------------------------------------------
    # 8. CRYPTOGRAPHIC APPROVAL & ORDER CONFIRMATION (Security Enforcement)
    # -------------------------------------------------------------------------
    quotation.dealflow_locked = True
    quotation.dealflow_approval_state = "pending_approval"
    token = generate_approval_token(quotation.id)

    req_conf = MockReq(
        headers={"Authorization": "Bearer integration_secret_token"},
        data={"approval_token": token},
        env=env,
    )
    monkeypatch.setattr(api_module, "request", req_conf)
    conf_resp = api_ctrl.confirm_order(quotation.id)
    assert conf_resp.status_code == 200
    assert conf_resp.json["success"] is True
    assert quotation.state == "sale"

    # -------------------------------------------------------------------------
    # 9. INVOICING ON CONFIRMED ORDER (Person 2 ERP Transaction)
    # -------------------------------------------------------------------------
    req_inv = MockReq(
        headers={"Authorization": "Bearer integration_secret_token"},
        env=env,
    )
    monkeypatch.setattr(api_module, "request", req_inv)
    inv_resp = api_ctrl.create_invoice(quotation.id)
    assert inv_resp.status_code == 200
    assert inv_resp.json["success"] is True
    assert "invoice_id" in inv_resp.json["data"]


def test_repository_bridge_robustness_and_governance_dual_write(test_setup):
    """Verifies that DealFlowRepositoryBridge dual-write methods succeed gracefully."""
    env, service, quotation, _ = test_setup
    from dealflow_odoo.services.dealflow_repository_bridge import DealFlowRepositoryBridge

    bridge = DealFlowRepositoryBridge()
    assert hasattr(bridge, "record_risk_assessment")
    assert hasattr(bridge, "record_approval_action")
    assert hasattr(bridge, "log_audit_event")

    # 1. Dual-write risk assessment
    risk_res = bridge.record_risk_assessment(
        deal_id="DEAL-TEST-001",
        risk_assessment_dict={
            "score": 25.0,
            "severity": "LOW",
            "factors": [{"type": "DISCOUNT_SEVERITY", "raw_value": 10.0, "weight": 1.0, "contribution": 10.0}],
        },
    )
    assert isinstance(risk_res, dict)
    assert "success" in risk_res

    # 2. Dual-write audit event
    audit_res = bridge.log_audit_event(
        deal_id="DEAL-TEST-001",
        event_type="RISK_EVALUATED",
        actor_role="Deal Guardian",
        summary="Test risk evaluation",
        details="Evaluated for test",
    )
    assert isinstance(audit_res, dict)
    assert "success" in audit_res

    # 3. Dual-write approval action with kwargs
    action_res = bridge.record_approval_action(
        request_id="REQ-001",
        action="APPROVED",
        actor_user_id=1,
        actor_name="Sales Manager",
        note="Approved within guidelines",
        conditions="Standard delivery",
    )
    assert isinstance(action_res, dict)
    assert "success" in action_res

    # 4. Governance adapter with db_bridge attached
    adapter = GovernanceAdapter(env=env, db_bridge=bridge)
    eval_res = adapter.evaluate_deal(quotation.id)
    assert "deal_id" in eval_res
    assert "risk" in eval_res


def test_fastapi_gateway_edge_cases_and_recommendations(test_setup):
    """Verifies FastAPI Decision Gateway robustness across edge-case query parameters and payloads."""
    _, _, _, client = test_setup

    # 1. Recommendations with empty string
    resp_empty = client.get("/api/governance/recommendations?line_product_ids=")
    assert resp_empty.status_code == 200
    assert resp_empty.json()["success"] is True

    # 2. Recommendations with malformed / non-digit tokens
    resp_malformed = client.get("/api/governance/recommendations?line_product_ids=72,abc,,99")
    assert resp_malformed.status_code == 200
    assert resp_malformed.json()["success"] is True

    # 3. Policies endpoint
    pol_resp = client.get("/api/governance/policies")
    assert pol_resp.status_code == 200
    assert "default_tier_limits" in pol_resp.json()

    # 4. Fallback Odoo order evaluation route
    order_eval_resp = client.post("/api/governance/order/999/evaluate")
    assert order_eval_resp.status_code == 200
    assert order_eval_resp.json()["deal_id"] == "DEAL-999"

