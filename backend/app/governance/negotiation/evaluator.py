"""Customer Negotiation Evaluator.

Processes customer counteroffers, assesses commercial drift against approved baseline,
and determines whether re-approval is required without directly mutating Odoo ERP truth.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from ..context import DealContext, DealLineContext
from ..approval.invalidation import MaterialChangeDetector, InvalidationResult, MaterialChangeItem


class CustomerNegotiationRequest(BaseModel):
    """Customer-submitted counteroffer proposal from portal."""
    deal_id: str
    odoo_sale_order_id: int
    requested_by: str
    message: Optional[str] = None
    requested_discounts: Dict[int, float] = Field(
        default_factory=dict,
        description="Map of odoo_line_id to requested discount percentage"
    )
    requested_quantities: Dict[int, float] = Field(
        default_factory=dict,
        description="Map of odoo_line_id to requested quantity"
    )

    @field_validator("requested_discounts")
    @classmethod
    def validate_discounts(cls, v: Dict[int, float]) -> Dict[int, float]:
        for line_id, disc in v.items():
            if disc < 0.0 or disc > 100.0:
                raise ValueError(f"Requested discount on line {line_id} must be between 0.0 and 100.0, got {disc}.")
        return v

    @field_validator("requested_quantities")
    @classmethod
    def validate_quantities(cls, v: Dict[int, float]) -> Dict[int, float]:
        for line_id, qty in v.items():
            if qty < 0.0:
                raise ValueError(f"Requested quantity on line {line_id} cannot be negative, got {qty}.")
        return v


class NegotiationEvaluationResult(BaseModel):
    """Evaluation output for customer counteroffer."""
    deal_id: str
    is_material: bool
    requires_reapproval: bool
    reasons: List[str] = Field(default_factory=list)
    changes: List[MaterialChangeItem] = Field(default_factory=list)
    proposed_context: DealContext
    summary: str


class NegotiationEvaluator:
    """Evaluates customer counter-proposals safely."""

    def __init__(self, detector: Optional[MaterialChangeDetector] = None):
        self.detector = detector or MaterialChangeDetector()

    def create_proposed_context(
        self,
        current_context: DealContext,
        request: CustomerNegotiationRequest
    ) -> DealContext:
        """Create a deep clone of the deal context with customer proposed modifications."""
        data = current_context.model_dump()
        proposed = DealContext.model_validate(data)

        # Apply line level discount / quantity adjustments
        for line in proposed.lines:
            if line.odoo_line_id in request.requested_discounts:
                line.discount_pct = float(request.requested_discounts[line.odoo_line_id])
            if line.odoo_line_id in request.requested_quantities:
                line.quantity = float(request.requested_quantities[line.odoo_line_id])

        # Recalculate financial totals deterministically
        proposed.recalculate_totals()
        return proposed

    def evaluate_negotiation(
        self,
        approved_baseline: Optional[DealContext],
        current_context: DealContext,
        request: CustomerNegotiationRequest
    ) -> NegotiationEvaluationResult:
        """Evaluate customer counteroffer against approved baseline."""
        proposed_ctx = self.create_proposed_context(current_context, request)

        baseline = approved_baseline or current_context
        changes = self.detector.detect_changes(baseline, proposed_ctx)
        material_changes = [c for c in changes if c.is_material]
        reasons = [c.reason for c in material_changes]
        is_material = len(material_changes) > 0

        if is_material:
            summary = (
                f"Customer counteroffer contains material commercial changes: "
                f"{'; '.join(reasons)}. Requires executive re-approval."
            )
        else:
            summary = "Customer proposed modifications are within approved policy boundaries."

        return NegotiationEvaluationResult(
            deal_id=request.deal_id,
            is_material=is_material,
            requires_reapproval=is_material,
            reasons=reasons,
            changes=material_changes,
            proposed_context=proposed_ctx,
            summary=summary
        )
