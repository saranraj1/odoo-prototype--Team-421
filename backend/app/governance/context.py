"""Normalized Deal Context (Contract 1).

Typed domain models for deal state consumed by all DealFlow governance engines.
Independent of Odoo ORM and database dependencies.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class CustomerContext(BaseModel):
    """Customer information relevant to governance (Odoo-sourced)."""
    odoo_partner_id: int
    name: str
    tier: str = Field(default="Bronze", description="Bronze, Silver, Gold, Platinum")
    email: Optional[str] = None
    company_name: Optional[str] = None

    @field_validator("tier")
    @classmethod
    def normalize_tier(cls, v: str) -> str:
        standard = {"bronze": "Bronze", "silver": "Silver", "gold": "Gold", "platinum": "Platinum"}
        return standard.get(v.lower(), v.title() if v else "Bronze")


class DealLineContext(BaseModel):
    """Individual quotation line item.
    
    Attributes:
        --- ODOO-SOURCED (Transactional truth from ERP) ---
        odoo_line_id: Odoo sale.order.line ID
        odoo_product_id: Odoo product.product ID
        product_name: Display name of product
        category_name: Product category name
        odoo_category_id: Product category ID
        quantity: Order quantity (must be >= 0)
        price_unit: List price per unit (must be >= 0)
        cost_unit: Standard cost per unit (must be >= 0)
        discount_pct: Commercial discount percentage (0.0 - 100.0)
        is_recurring: True if line represents a subscription
        recurring_interval: Monthly, quarterly, yearly

        --- DEALFLOW-DERIVED (Calculated by Governance) ---
        subtotal: Net untaxed line amount after discount
        margin_amount: Net gross profit contribution (subtotal - cost)
        margin_pct: Margin percentage relative to subtotal
    """
    # ODOO-SOURCED
    odoo_line_id: int
    odoo_product_id: int
    product_name: str
    category_name: str
    odoo_category_id: int
    quantity: float = Field(ge=0.0, description="Order quantity")
    price_unit: float = Field(ge=0.0, description="Unit sales price")
    cost_unit: float = Field(default=0.0, ge=0.0, description="Unit cost")
    discount_pct: float = Field(default=0.0, ge=0.0, le=100.0, description="Discount % (0-100)")
    is_recurring: bool = Field(default=False, description="True for subscription lines")
    recurring_interval: Optional[str] = Field(default=None, description="monthly, quarterly, yearly")

    # DEALFLOW-DERIVED
    subtotal: float = Field(default=0.0, description="Untaxed subtotal after discount")
    margin_amount: float = Field(default=0.0, description="Subtotal minus (cost_unit * quantity)")
    margin_pct: float = Field(default=0.0, description="Margin as percentage of subtotal")

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Line quantity cannot be negative.")
        return v

    @field_validator("price_unit")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Unit price cannot be negative.")
        return v

    @field_validator("cost_unit")
    @classmethod
    def validate_cost(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Unit cost cannot be negative.")
        return v

    @field_validator("discount_pct")
    @classmethod
    def validate_discount(cls, v: float) -> float:
        if v < 0.0 or v > 100.0:
            raise ValueError(f"Discount percentage must be between 0.0 and 100.0, got {v}.")
        return round(v, 2)

    def calculate_metrics(self) -> None:
        """Recalculate line totals and margins deterministically."""
        gross = round(self.quantity * self.price_unit, 2)
        discount_fraction = max(0.0, min(100.0, self.discount_pct)) / 100.0
        self.subtotal = round(gross * (1.0 - discount_fraction), 2)
        total_cost = round(self.quantity * self.cost_unit, 2)
        self.margin_amount = round(self.subtotal - total_cost, 2)
        if self.subtotal > 0:
            self.margin_pct = round((self.margin_amount / self.subtotal) * 100.0, 2)
        elif self.quantity > 0 and self.cost_unit > 0:
            # Zero subtotal (100% discount) with non-zero cost results in -100% margin
            self.margin_pct = -100.0
        else:
            self.margin_pct = 0.0


class DealTotals(BaseModel):
    """Aggregated financial totals for a deal (DealFlow-derived)."""
    amount_untaxed: float = 0.0
    total_discount_amount: float = 0.0
    projected_margin_amount: float = 0.0
    projected_margin_pct: float = 0.0


class DealContext(BaseModel):
    """Normalized Deal Context representing the operational deal state.
    
    Acts as the single source of truth for governance evaluation.
    Decoupled from Odoo ORM models and PostgreSQL schemas.
    """
    deal_id: str = Field(description="UUID string identifying the DealFlow deal")
    odoo_sale_order_id: int
    order_name: str
    customer: CustomerContext
    lines: List[DealLineContext] = Field(default_factory=list)
    totals: DealTotals = Field(default_factory=DealTotals)
    status: str = Field(default="DRAFT", description="DRAFT, PENDING_APPROVAL, APPROVED, CONFIRMED")
    approval_state: str = Field(default="DRAFT", description="DRAFT, PENDING_MANAGER, PENDING_FINANCE, APPROVED, INVALIDATED, REJECTED")
    stalled_days: int = Field(default=0, ge=0, description="Days since last activity")
    currency: str = Field(default="INR")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def recalculate_totals(self) -> None:
        """Deterministically aggregate totals from line items."""
        total_untaxed = 0.0
        total_gross = 0.0
        total_margin = 0.0

        for line in self.lines:
            line.calculate_metrics()
            total_untaxed += line.subtotal
            total_gross += (line.quantity * line.price_unit)
            total_margin += line.margin_amount

        self.totals.amount_untaxed = round(total_untaxed, 2)
        self.totals.total_discount_amount = round(total_gross - total_untaxed, 2)
        self.totals.projected_margin_amount = round(total_margin, 2)
        if total_untaxed > 0:
            self.totals.projected_margin_pct = round((total_margin / total_untaxed) * 100.0, 2)
        elif total_gross > 0 and total_margin < 0:
            self.totals.projected_margin_pct = -100.0
        else:
            self.totals.projected_margin_pct = 0.0

    def create_approved_snapshot(self) -> "DealContext":
        """Create an immutable, detached baseline snapshot of this approved deal.
        
        Guarantees that subsequent in-place mutations to current deal context
        cannot accidentally alter the approved baseline.
        """
        snapshot_data = self.model_dump()
        snapshot = DealContext.model_validate(snapshot_data)
        snapshot.approval_state = "APPROVED"
        snapshot.recalculate_totals()
        return snapshot

