# -*- coding: utf-8 -*-
"""Verification tests for the FastAPI Decision Engine Gateway.

Verifies:
- Liveness & readiness probes (/health, /api/health)
- Deal Guardian evaluation (/api/governance/evaluate)
- Odoo order evaluation route (/api/governance/order/{order_id}/evaluate)
- Approval state machine transitions (/api/governance/approve)
- Customer negotiation invalidation check (/api/governance/negotiate)
- Fulfillment planner (/api/governance/fulfillment)
- Governance policies and candidate recommendations endpoints
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.governance.context import DealContext, CustomerContext, DealLineContext


@pytest.fixture
def client():
    return TestClient(app)


def test_health_probes(client):
    r1 = client.get("/health")
    assert r1.status_code == 200
    assert r1.json()["status"] == "healthy"

    r2 = client.get("/api/health")
    assert r2.status_code == 200
    assert r2.json()["status"] == "healthy"


def test_evaluate_deal_endpoint(client, sample_gold_deal):
    payload = sample_gold_deal.model_dump()

    resp = client.post("/api/governance/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["deal_id"] == sample_gold_deal.deal_id
    assert "risk" in data
    assert "approval" in data
    assert "next_best_action" in data
    assert data["approval"]["required"] is True
    assert data["risk"]["score"] > 0


def test_evaluate_odoo_order_endpoint(client):
    resp = client.post("/api/governance/order/1/evaluate")
    assert resp.status_code == 200
    data = resp.json()
    assert "deal_id" in data
    assert "risk" in data
    assert "approval" in data


def test_approval_action_transition(client):
    req_body = {
        "deal_id": "DEAL-1024",
        "current_stage": "PENDING_MANAGER",
        "action": "APPROVE",
        "approver_role": "SALES_MANAGER",
        "comments": "Approved 18% discount",
    }
    resp = client.post("/api/governance/approve", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["new_stage"] == "APPROVED"
    assert data["is_approved"] is True


def test_negotiation_invalidation_endpoint(client, sample_gold_deal):
    baseline = sample_gold_deal.model_copy(deep=True)
    baseline.approval_state = "APPROVED"

    proposed = sample_gold_deal.model_copy(deep=True)
    proposed.lines[0].discount_pct = 25.0
    proposed.recalculate_totals()

    req_body = {
        "proposed_context": proposed.model_dump(),
        "approved_baseline": baseline.model_dump(),
        "current_stage": "APPROVED",
    }
    resp = client.post("/api/governance/negotiate", json=req_body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["approval_invalidated"] is True
    assert any("25.0%" in r or "exceeds" in r or "discount" in r.lower() for r in data["reasons"])


def test_fulfillment_plan_endpoint(client, sample_gold_deal):
    resp = client.post("/api/governance/fulfillment", json=sample_gold_deal.model_dump())
    assert resp.status_code == 200
    data = resp.json()
    assert "total_requested_qty" in data
    assert "line_plans" in data
    assert len(data["line_plans"]) >= 1


def test_policies_endpoint(client):
    resp = client.get("/api/governance/policies")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "default_tier_limits" in data
    assert "default_category_limits" in data


def test_recommendations_endpoint(client):
    resp = client.get("/api/governance/recommendations?line_product_ids=72")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "candidates" in data
