from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class PolicyReasonCode(str, Enum):
    COMPLIANT = "COMPLIANT"
    EXACT_CEILING = "EXACT_CEILING"
    DISCOUNT_EXCESS = "DISCOUNT_EXCESS"


class DiscountPolicy(BaseModel):
    """Configurable discount policy rule."""
    id: Optional[str] = None
    name: str
    company_id: Optional[int] = None
    customer_tier: Optional[str] = Field(default=None, description="Bronze, Silver, Gold, etc.")
    odoo_category_id: Optional[int] = Field(default=None, description="Category this ceiling applies to")
    category_name: Optional[str] = None
    max_discount_pct: float = Field(ge=0.0, le=100.0, description="Maximum discount allowed without approval")
    manager_threshold: float = Field(default=5.0, description="Excess beyond ceiling requiring manager approval")
    finance_threshold: float = Field(default=15.0, description="Excess beyond ceiling requiring finance approval")
    minimum_margin_pct: float = Field(default=0.0, description="Minimum acceptable margin percentage")
    priority: int = Field(default=10, description="Higher number = higher specificity")
    active: bool = True


class LinePolicyResult(BaseModel):
    """Result of policy evaluation for an individual line item."""
    odoo_line_id: int
    product_name: str
    category_name: str
    customer_tier: str
    customer_tier_limit: float
    category_limit: float
    effective_ceiling: float
    actual_discount: float
    excess: float
    is_violation: bool
    code: str = Field(default="COMPLIANT", description="COMPLIANT, EXACT_CEILING, DISCOUNT_EXCESS")
    reason: str


class PolicyResolutionResult(BaseModel):
    """Consolidated policy evaluation result across all line items."""
    line_results: List[LinePolicyResult] = Field(default_factory=list)
    has_violations: bool = False
    max_excess: float = 0.0
    violations_count: int = 0
