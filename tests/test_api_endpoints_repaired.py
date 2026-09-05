# -*- coding: utf-8 -*-
"""Verification test suite for repaired API endpoints.

Tests:
- Health check route /api/dealflow/health
- GET and POST support on /api/dealflow/order/<id>/context
- Proper JSON dictionary fulfillment plan handling on /api/dealflow/order/<id>/fulfillment
- Invoicing on confirmed orders via /api/dealflow/order/<id>/invoice
- Cryptographic approval confirmation on /api/dealflow/order/<id>/confirm
- Customer portal deal retrieval and negotiation submission
"""

import json
import pytest
from dealflow_odoo.controllers.api import DealFlowApiController
from dealflow_odoo.controllers.portal import PortalController
import dealflow_odoo.controllers.api as api_module
import dealflow_odoo.controllers.portal as portal_module
from dealflow_odoo.security.security_utils import generate_approval_token
from dealflow_odoo.services.integration_service import OdooIntegrationService


class MockApiReq:
    def __init__(self, headers=None, params=None, data=None, env=None):
        self.env = env
        self.params = params or {}
        raw_bytes = json.dumps(data).encode("utf-8") if data is not None else b""
        self.httprequest = type("HttpReq", (), {
            "headers": headers or {},
            "environ": {},
            "data": raw_bytes
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
def api_test_env(mock_odoo_env, sample_quotation):
    service = OdooIntegrationService(env=mock_odoo_env)
    DealFlowApiController.set_service_override(service)
    DealFlowApiController.set_enforce_auth_in_test(True)
    DealFlowApiController.set_api_key("test_secret_123")
    yield mock_odoo_env, service, sample_quotation
    DealFlowApiController.set_service_override(None)
    DealFlowApiController.set_enforce_auth_in_test(False)


def test_health_check_endpoint(monkeypatch):
    ctrl = DealFlowApiController()
    req = MockApiReq()
    monkeypatch.setattr(api_module, "request", req)
    resp = ctrl.health_check()
    assert resp.status_code == 200
    assert resp.json["success"] is True
    assert resp.json["status"] == "healthy"
    assert "timestamp" in resp.json


def test_order_context_get_and_post(api_test_env, monkeypatch):
    env, service, quotation = api_test_env
    ctrl = DealFlowApiController()

    # Authenticated GET/POST context retrieval
    req = MockApiReq(
        headers={"Authorization": "Bearer test_secret_123"},
        env=env,
    )
    monkeypatch.setattr(api_module, "request", req)
    resp = ctrl.order_context(quotation.id)
    assert resp.status_code == 200
    assert resp.json["success"] is True
    assert resp.json["data"]["order_id"] == quotation.id
    assert "lines" in resp.json["data"]


def test_apply_fulfillment_plan_with_dict_payload(api_test_env, monkeypatch):
    env, service, quotation = api_test_env
    ctrl = DealFlowApiController()

    plan_payload = {
        "plan": {
            "allocations": [
                {
                    "product_id": quotation.order_line[0].product_id.id,
                    "warehouse_id": 1,
                    "warehouse_name": "Main Warehouse",
                    "quantity": 1.0,
                }
            ]
        }
    }

    req = MockApiReq(
        headers={"Authorization": "Bearer test_secret_123"},
        data=plan_payload,
        env=env,
    )
    monkeypatch.setattr(api_module, "request", req)
    resp = ctrl.apply_fulfillment(quotation.id)
    assert resp.status_code == 200
    assert resp.json["success"] is True
    assert resp.json["data"]["status"] == "applied"


def test_confirm_order_with_cryptographic_token(api_test_env, monkeypatch):
    env, service, quotation = api_test_env
    ctrl = DealFlowApiController()

    quotation.dealflow_locked = True
    quotation.dealflow_approval_state = "pending_approval"
    quotation.state = "draft"

    # Blocked without token
    req_blocked = MockApiReq(
        headers={"Authorization": "Bearer test_secret_123"},
        data={},
        env=env,
    )
    monkeypatch.setattr(api_module, "request", req_blocked)
    resp_blocked = ctrl.confirm_order(quotation.id)
    assert resp_blocked.status_code == 403
    assert resp_blocked.json["success"] is False

    # Confirmed with valid token
    token = generate_approval_token(quotation.id)
    req_confirmed = MockApiReq(
        headers={"Authorization": "Bearer test_secret_123"},
        data={"approval_token": token},
        env=env,
    )
    monkeypatch.setattr(api_module, "request", req_confirmed)
    resp_confirmed = ctrl.confirm_order(quotation.id)
    assert resp_confirmed.status_code == 200
    assert resp_confirmed.json["success"] is True
    assert resp_confirmed.json["data"]["state"] == "sale"


def test_create_invoice_for_confirmed_order(api_test_env, monkeypatch):
    env, service, quotation = api_test_env
    ctrl = DealFlowApiController()

    quotation.state = "sale"
    req = MockApiReq(
        headers={"Authorization": "Bearer test_secret_123"},
        env=env,
    )
    monkeypatch.setattr(api_module, "request", req)
    resp = ctrl.create_invoice(quotation.id)
    assert resp.status_code == 200
    assert resp.json["success"] is True
    assert "invoice_id" in resp.json["data"]


def test_portal_deal_and_negotiation_clean(mock_odoo_env, sample_quotation, monkeypatch):
    portal_ctrl = PortalController()
    customer_user = mock_odoo_env["res.users"].create({
        "id": 201,
        "name": "Customer User",
        "partner_id": sample_quotation.partner_id,
        "groups": {"base.group_portal", "dealflow_odoo.group_dealflow_portal"},
    })
    mock_odoo_env.user = customer_user

    # 1. Read quote
    req_read = MockApiReq(env=mock_odoo_env)
    monkeypatch.setattr(portal_module, "request", req_read)
    resp = portal_ctrl.portal_get_deal(sample_quotation.id)
    data = json.loads(resp.data.decode("utf-8"))
    assert resp.status_code == 200
    assert data["success"] is True
    assert not any("margin" in line for line in data["data"]["lines"])

    # 2. Submit negotiation
    req_neg = MockApiReq(
        data={"order_id": sample_quotation.id, "requested_discount": 10.0, "customer_note": "Requesting 10%"},
        env=mock_odoo_env,
    )
    monkeypatch.setattr(portal_module, "request", req_neg)
    neg_resp = portal_ctrl.portal_submit_negotiation()
    neg_data = json.loads(neg_resp.data.decode("utf-8"))
    assert neg_resp.status_code == 201
    assert neg_data["success"] is True
    assert neg_data["data"]["status"] == "submitted"
