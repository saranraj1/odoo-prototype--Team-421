# -*- coding: utf-8 -*-
"""
DealFlow360 Data Contracts & DTOs
Author: Person 1 (DB Architect)
Purpose: Authoritative data contracts shared across all services (Odoo Integration, Governance Engine, Frontend API).
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime

# =============================================================================
# 1. Central Deal DTOs
# =============================================================================
@dataclass
class DealDTO:
    id: str
    odoo_sale_order_id: int
    odoo_partner_id: int
    owner_user_id: int
    company_id: int = 1
    status: str = "DRAFT"
    approval_state: str = "NONE"
    health_status: str = "HEALTHY"
    current_risk_score: float = 0.00
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class DealLineContextDTO:
    odoo_line_id: int
    product_id: int
    product_name: str
    category_id: Optional[int]
    quantity: float
    unit_price: float
    discount: float
    cost: float
    price_subtotal: float

@dataclass
class DealPartnerContextDTO:
    id: int
    name: str
    email: str
    customer_tier: str  # BRONZE, SILVER, GOLD

@dataclass
class DealContextDTO:
    """Normalized payload sent from Person 2 (Odoo) into Person 3 (Governance)."""
    odoo_sale_order_id: int
    order_name: str
    partner: DealPartnerContextDTO
    amount_untaxed: float
    amount_total: float
    blended_margin: float
    lines: List[DealLineContextDTO] = field(default_factory=list)
    date_order: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 2. Discount Policy DTO
# =============================================================================
@dataclass
class DiscountPolicyDTO:
    id: str
    name: str
    customer_tier: str  # BRONZE, SILVER, GOLD, ALL
    product_category_id: Optional[int]
    max_discount_pct: float
    manager_threshold: float
    finance_threshold: float
    minimum_margin_pct: float = 15.00
    priority: int = 10
    active: bool = True
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 3. Risk Engine DTOs
# =============================================================================
@dataclass
class RiskFactorDTO:
    factor_type: str
    raw_value: float
    weight: float
    contribution: float
    reason: str
    source_reference: Optional[str] = None
    id: Optional[str] = None
    risk_assessment_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class RiskAssessmentDTO:
    deal_id: str
    risk_score: float
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    decision: str  # AUTO_APPROVED, MANAGER_APPROVAL, FINANCE_APPROVAL, REJECTED
    factors: List[RiskFactorDTO] = field(default_factory=list)
    id: Optional[str] = None
    trigger_type: str = "SYSTEM_EVALUATION"
    policy_version: str = "v1.0"
    calculated_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 4. Approval Engine DTOs
# =============================================================================
@dataclass
class ApprovalActionDTO:
    approval_request_id: str
    actor_user_id: int
    action: str  # APPROVED, REJECTED, RETURNED, DELEGATED
    reason: Optional[str] = None
    id: Optional[str] = None
    created_at: Optional[datetime] = None

@dataclass
class ApprovalRequestDTO:
    deal_id: str
    risk_assessment_id: str
    required_level: str  # SALES_MANAGER, FINANCE, EXEC
    sequence: int = 1
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED, RETURNED, INVALIDATED
    id: Optional[str] = None
    actions: List[ApprovalActionDTO] = field(default_factory=list)
    requested_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 5. Customer Portal Negotiation DTOs
# =============================================================================
@dataclass
class NegotiationChangeDTO:
    negotiation_request_id: str
    odoo_sale_order_line_id: int
    field_name: str
    old_value: str
    requested_value: str
    id: Optional[str] = None

@dataclass
class NegotiationRequestDTO:
    deal_id: str
    odoo_sale_order_id: int
    customer_partner_id: int
    message: Optional[str] = None
    requested_by: str = "CUSTOMER"
    status: str = "PENDING"  # PENDING, ACCEPTED, COUNTERED, REJECTED, EXPIRED
    changes: List[NegotiationChangeDTO] = field(default_factory=list)
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 6. Fulfillment Plan DTOs
# =============================================================================
@dataclass
class FulfillmentPlanLineDTO:
    odoo_product_id: int
    odoo_warehouse_id: int
    requested_qty: float
    allocated_qty: float
    backorder_qty: float = 0.0
    shipping_cost: float = 0.0
    id: Optional[str] = None
    fulfillment_plan_id: Optional[str] = None

@dataclass
class FulfillmentPlanDTO:
    deal_id: str
    odoo_sale_order_id: int
    status: str = "PROPOSED"  # PROPOSED, ACCEPTED, OVERRIDDEN, EXECUTED
    estimated_shipments: int = 1
    estimated_shipping_cost: float = 0.0
    algorithm_version: str = "v1.0"
    lines: List[FulfillmentPlanLineDTO] = field(default_factory=list)
    id: Optional[str] = None
    generated_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 7. Recommendation DTO
# =============================================================================
@dataclass
class RecommendationDTO:
    deal_id: str
    odoo_product_id: int
    recommendation_type: str  # UPSELL, CROSS_SELL, PROMOTION, MARGIN_BOOST
    score: float
    margin_delta: float
    reason: str
    source: str = "CO_PURCHASE"
    status: str = "ACTIVE"
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 8. Deal Health & Anomaly DTO
# =============================================================================
@dataclass
class DealHealthSnapshotDTO:
    deal_id: str
    health_status: str  # HEALTHY, STALLED, AT_RISK, CRITICAL
    overall_score: float
    stalled_score: float = 0.0
    discount_anomaly_score: float = 0.0
    delivery_risk_score: float = 0.0
    approval_delay_score: float = 0.0
    id: Optional[str] = None
    calculated_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 9. Audit Event DTO
# =============================================================================
@dataclass
class AuditEventDTO:
    deal_id: str
    event_type: str
    entity_type: str
    entity_id: str
    actor_type: str = "SYSTEM"
    actor_id: int = 0
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    id: Optional[str] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 10. Upsell Rule Configuration DTO
# =============================================================================
@dataclass
class UpsellRuleDTO:
    base_product_id: int
    suggested_product_id: int
    min_margin_threshold: float = 15.00
    is_promoted: bool = False
    active: bool = True
    company_id: int = 1
    id: Optional[str] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 11. Subscription Proration & Credit Note Event DTO
# =============================================================================
@dataclass
class SubscriptionEventDTO:
    deal_id: str
    odoo_subscription_id: int
    event_type: str  # PLAN_CHANGE, QUANTITY_CHANGE, CANCELLATION, RENEWAL, PRORATION_ADJUSTMENT
    old_plan: Optional[str] = None
    new_plan: Optional[str] = None
    old_quantity: Optional[int] = None
    new_quantity: Optional[int] = None
    billing_cycle: Optional[str] = None  # MONTHLY, QUARTERLY, YEARLY
    proration_days_remaining: Optional[int] = None
    proration_total_days: Optional[int] = None
    prorated_amount: Optional[float] = None
    credit_note_amount: float = 0.00
    odoo_credit_note_id: Optional[int] = None
    reason: Optional[str] = None
    id: Optional[str] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 12. Warehouse Configuration & Shipping Cost Weight DTO
# =============================================================================
@dataclass
class WarehouseConfigDTO:
    odoo_warehouse_id: int
    name: str
    location: Optional[str] = None
    shipping_cost_weight: float = 1.00
    is_primary: bool = False
    active: bool = True
    company_id: int = 1
    id: Optional[str] = None
    created_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

# =============================================================================
# 13. User Management & Permission Matrix DTO (Problem Statement Section 4 & 6.1)
# =============================================================================
@dataclass
class UserDTO:
    id: str
    odoo_user_id: int
    name: str
    email: str
    role: str = "REP"  # REP, MANAGER, FINANCE, ADMIN, PORTAL
    can_approve_level1: bool = False
    can_approve_level2: bool = False
    has_portal_access: bool = False
    company_id: int = 1
    active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


