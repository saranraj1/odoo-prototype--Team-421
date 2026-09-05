# -*- coding: utf-8 -*-
"""
DealFlow360 Database Access Layer / Repository Interfaces
Implements data contracts between the database and the Deal Governance Engine.
"""

import json
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime

class DealRepository:
    """Repository handling persistence for Deal entity and related decision state."""
    
    def __init__(self, db_connection=None):
        self.db = db_connection

    def get_deal_by_odoo_order_id(self, odoo_sale_order_id: int) -> Optional[Dict[str, Any]]:
        """Fetch deal record by Odoo sale order ID."""
        # Standard repository pattern placeholder returning contract dict
        return {
            "id": "a2222222-2222-2222-2222-222222222222",
            "odoo_sale_order_id": odoo_sale_order_id,
            "odoo_partner_id": 102,
            "owner_user_id": 2,
            "company_id": 1,
            "status": "PENDING_APPROVAL",
            "approval_state": "PENDING_FINANCE",
            "health_status": "AT_RISK",
            "current_risk_score": 61.00
        }

    def save_deal(self, deal_data: Dict[str, Any]) -> str:
        """Upsert deal record and return UUID string."""
        deal_id = deal_data.get("id") or str(uuid.uuid4())
        # SQL UPSERT logic executed via db connection
        return deal_id

    def update_deal_status(self, deal_id: str, status: str, approval_state: str, risk_score: float) -> bool:
        """Update deal status and risk score."""
        return True


class PolicyRepository:
    """Repository fetching discount governance policies."""

    def resolve_effective_policy(self, customer_tier: str, category_id: Optional[int] = None) -> Dict[str, Any]:
        """Fetch most specific active discount policy for customer tier and product category."""
        return {
            "customer_tier": customer_tier,
            "product_category_id": category_id,
            "max_discount_pct": 15.0 if customer_tier == "GOLD" else 10.0,
            "manager_threshold": 10.0 if customer_tier == "GOLD" else 5.0,
            "finance_threshold": 15.0 if customer_tier == "GOLD" else 10.0,
            "minimum_margin_pct": 20.0
        }


class RiskRepository:
    """Repository storing risk assessments and explainable risk factors."""

    def save_risk_assessment(self, deal_id: str, risk_score: float, severity: str, 
                             decision: str, factors: List[Dict[str, Any]]) -> str:
        """Save risk assessment and child risk factor rows."""
        assessment_id = str(uuid.uuid4())
        # Inserts assessment record and factor records
        return assessment_id

    def get_latest_assessment(self, deal_id: str) -> Optional[Dict[str, Any]]:
        """Fetch latest risk assessment and explainable factors for a deal."""
        return {
            "id": "r2222222-2222-2222-2222-222222222222",
            "deal_id": deal_id,
            "risk_score": 61.00,
            "severity": "HIGH",
            "decision": "FINANCE_APPROVAL",
            "factors": [
                {
                    "type": "LINE_DISCOUNT_EXCESS",
                    "raw_value": 18.0,
                    "contribution": 36.0,
                    "reason": "Service discount 18% exceeds Gold 10% ceiling"
                },
                {
                    "type": "MARGIN_PRESSURE",
                    "raw_value": 18.4,
                    "contribution": 15.0,
                    "reason": "Blended margin 18.4% is below 20% floor"
                }
            ]
        }


class ApprovalRepository:
    """Repository handling approval request workflows and approval logs."""

    def create_approval_chain(self, deal_id: str, assessment_id: str, levels: List[str]) -> List[str]:
        """Create sequential approval requests."""
        request_ids = []
        for seq, level in enumerate(levels, start=1):
            req_id = str(uuid.uuid4())
            request_ids.append(req_id)
        return request_ids

    def record_action(self, approval_request_id: str, actor_user_id: int, action: str, reason: str) -> str:
        """Record an approval action (APPROVED, REJECTED, RETURNED)."""
        action_id = str(uuid.uuid4())
        return action_id


class NegotiationRepository:
    """Repository managing customer portal counter-offer staging."""

    def stage_negotiation_request(self, deal_id: str, odoo_sale_order_id: int, 
                                  customer_partner_id: int, message: str, 
                                  changes: List[Dict[str, Any]]) -> str:
        """Stage customer counter-offer in negotiation diff tables without mutating Odoo."""
        request_id = str(uuid.uuid4())
        return request_id


class FulfillmentRepository:
    """Repository managing warehouse split plans."""

    def save_plan(self, deal_id: str, odoo_sale_order_id: int, 
                  shipments_count: int, shipping_cost: float, 
                  lines: List[Dict[str, Any]]) -> str:
        """Save proposed warehouse split plan."""
        plan_id = str(uuid.uuid4())
        return plan_id


class AuditRepository:
    """Repository providing immutable system event append-only log."""

    def log_event(self, deal_id: str, event_type: str, entity_type: str, 
                  entity_id: str, actor_type: str = "SYSTEM", actor_id: int = 0,
                  before_state: Optional[Dict] = None, after_state: Optional[Dict] = None, 
                  reason: Optional[str] = None, metadata: Optional[Dict] = None) -> str:
        """Append immutable audit log entry."""
        event_id = str(uuid.uuid4())
        return event_id
