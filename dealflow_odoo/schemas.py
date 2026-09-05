"""DealFlow360 Odoo Integration — Shared Schemas, Types & Data Contracts.

This module formalizes the exact data interfaces passed between DealFlow and Odoo.
All adapters and services must adhere to these structures.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


class DealFlowIntegrationError(Exception):
    """Base exception for all DealFlow-Odoo integration failures."""

    def __init__(self, code: str, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": False,
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            },
        }


class ValidationError(DealFlowIntegrationError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__("VALIDATION_ERROR", message, details)


class AuthorizationError(DealFlowIntegrationError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__("AUTHORIZATION_ERROR", message, details)


class NotFoundError(DealFlowIntegrationError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__("NOT_FOUND", message, details)


class InvalidStateError(DealFlowIntegrationError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__("INVALID_STATE", message, details)


class OdooExecutionError(DealFlowIntegrationError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__("ODOO_FAILURE", message, details)


# Optional native Odoo exception imports with fallback definitions
try:
    from odoo.exceptions import (
        AccessDenied as OdooAccessDenied,
        AccessError as OdooAccessError,
        MissingError as OdooMissingError,
        UserError as OdooUserError,
        ValidationError as OdooValidationError,
    )
except ImportError:
    class OdooValidationError(Exception):
        pass

    class OdooAccessError(Exception):
        pass

    class OdooAccessDenied(Exception):
        pass

    class OdooMissingError(Exception):
        pass

    class OdooUserError(Exception):
        pass


@dataclass
class CustomerDTO:
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    credit_limit: float = 0.0
    total_invoiced: float = 0.0
    is_company: bool = True
    street: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


@dataclass
class ProductDTO:
    id: int
    name: str
    default_code: Optional[str] = None
    list_price: float = 0.0
    standard_price: float = 0.0  # cost
    category_id: int = 1
    category_name: str = "All"
    type: str = "consu"  # consu, service, product
    is_recurring: bool = False
    recurring_interval: Optional[str] = None  # month, year


@dataclass
class OrderLineDTO:
    id: int
    product_id: int
    product_name: str
    category_name: str
    product_uom_qty: float
    price_unit: float
    cost_price: float
    discount: float
    price_subtotal: float
    margin: float
    margin_percent: float
    is_recurring: bool = False
    recurring_interval: Optional[str] = None


@dataclass
class DealContextDTO:
    deal_id: Optional[str]
    order_id: int
    order_name: str
    customer: CustomerDTO
    state: str
    date_order: str
    currency: str
    amount_untaxed: float
    amount_tax: float
    amount_total: float
    blended_discount: float
    total_cost: float
    total_margin: float
    margin_percent: float
    lines: List[OrderLineDTO] = field(default_factory=list)
    has_recurring_lines: bool = False
    mrr: float = 0.0
    arr: float = 0.0
    dealflow_risk_score: float = 0.0
    dealflow_approval_state: str = "draft"
    dealflow_health_status: str = "healthy"
    dealflow_locked: bool = False


@dataclass
class FulfillmentSplitItem:
    product_id: int
    warehouse_id: int
    warehouse_name: str
    quantity: float


@dataclass
class FulfillmentPlanDTO:
    deal_id: Optional[str] = None
    order_id: int = 0
    allocations: List[FulfillmentSplitItem] = field(default_factory=list)
    notes: Optional[str] = None
    batch_id: Optional[str] = None
    requested_qty: Optional[float] = None


@dataclass
class NegotiationRequestDTO:
    order_id: int
    customer_id: int
    requested_discount: float
    requested_terms: Optional[str] = None
    customer_note: Optional[str] = None
    target_line_discounts: Optional[Dict[int, float]] = None


@dataclass
class EventPayloadDTO:
    event_type: str
    timestamp: str
    actor_id: Optional[int]
    record_id: int
    model: str
    data: Dict[str, Any]
    dealflow_deal_id: Optional[str] = None
