"""DealFlow360 Odoo Integration — Shared Constants & Invariants.

All parallel agents MUST conform to these constants.
"""

# DealFlow Approval States on Sale Order
APPROVAL_STATE_DRAFT = "draft"
APPROVAL_STATE_PENDING = "pending_approval"
APPROVAL_STATE_APPROVED = "approved"
APPROVAL_STATE_REJECTED = "rejected"
APPROVAL_STATE_REAPPROVAL_REQUIRED = "reapproval_required"

APPROVAL_STATES = [
    (APPROVAL_STATE_DRAFT, "Draft"),
    (APPROVAL_STATE_PENDING, "Pending Approval"),
    (APPROVAL_STATE_APPROVED, "Approved"),
    (APPROVAL_STATE_REJECTED, "Rejected"),
    (APPROVAL_STATE_REAPPROVAL_REQUIRED, "Reapproval Required"),
]

# Risk Ratings
RISK_LEVEL_LOW = "low"
RISK_LEVEL_MEDIUM = "medium"
RISK_LEVEL_HIGH = "high"
RISK_LEVEL_CRITICAL = "critical"

RISK_LEVELS = [
    (RISK_LEVEL_LOW, "Low Risk"),
    (RISK_LEVEL_MEDIUM, "Medium Risk"),
    (RISK_LEVEL_HIGH, "High Risk"),
    (RISK_LEVEL_CRITICAL, "Critical Risk"),
]

# Deal Health Statuses
HEALTH_STATUS_HEALTHY = "healthy"
HEALTH_STATUS_AT_RISK = "at_risk"
HEALTH_STATUS_CRITICAL = "critical"

HEALTH_STATUSES = [
    (HEALTH_STATUS_HEALTHY, "Healthy"),
    (HEALTH_STATUS_AT_RISK, "At Risk"),
    (HEALTH_STATUS_CRITICAL, "Critical"),
]

# Negotiation Request Statuses
NEGOTIATION_STATUS_SUBMITTED = "submitted"
NEGOTIATION_STATUS_UNDER_REVIEW = "under_review"
NEGOTIATION_STATUS_APPROVED = "approved"
NEGOTIATION_STATUS_REJECTED = "rejected"

NEGOTIATION_STATUSES = [
    (NEGOTIATION_STATUS_SUBMITTED, "Submitted"),
    (NEGOTIATION_STATUS_UNDER_REVIEW, "Under Review"),
    (NEGOTIATION_STATUS_APPROVED, "Approved"),
    (NEGOTIATION_STATUS_REJECTED, "Rejected"),
]

# Event Types for Internal Webhook / Callbacks
EVENT_SALE_ORDER_CREATED = "sale.order.created"
EVENT_SALE_ORDER_CHANGED = "sale.order.changed"
EVENT_SALE_ORDER_LINE_CHANGED = "sale.order.line.changed"
EVENT_DISCOUNT_CHANGED = "discount.changed"
EVENT_CUSTOMER_NEGOTIATION_SUBMITTED = "customer.negotiation.submitted"
EVENT_ORDER_APPROVED = "order.approved"
EVENT_ORDER_CONFIRMED = "order.confirmed"
EVENT_STOCK_CHANGED = "stock.changed"
EVENT_INVOICE_CREATED = "invoice.created"
EVENT_PAYMENT_RECORDED = "payment.recorded"

# Standard Discount Thresholds (Policy Rules)
DEFAULT_MAX_REP_DISCOUNT = 10.0          # Rep can offer up to 10% without approval
DEFAULT_MAX_MGR_DISCOUNT = 20.0          # Manager approval needed between 10% and 20%
DEFAULT_FINANCE_DISCOUNT_THRESHOLD = 20.0 # Above 20% requires Finance approval

CATEGORY_DISCOUNT_CEILINGS = {
    "Hardware": 15.0,
    "Service": 15.0,
    "Subscription": 10.0,
}

# Error Codes
ERR_VALIDATION = "VALIDATION_ERROR"
ERR_AUTHORIZATION = "AUTHORIZATION_ERROR"
ERR_NOT_FOUND = "NOT_FOUND"
ERR_INVALID_STATE = "INVALID_STATE"
ERR_ODOO_FAILURE = "ODOO_FAILURE"
ERR_TIMEOUT = "TIMEOUT"
ERR_CONFLICT = "CONFLICT"
