"""Material Change Invalidation Engine (GOV-04 - The Killer Moment).

Compares proposed changes against the APPROVED BASELINE.
Automatically invalidates stale approvals when customer negotiation breaches approved terms.
"""

from typing import Tuple, List, Optional, Dict, Any
from pydantic import BaseModel, Field
from ..context import DealContext
from .state_machine import ApprovalStage


class MaterialChangeItem(BaseModel):
    """Structured record of an individual commercial change."""
    is_material: bool
    change_type: str = Field(description="DISCOUNT_INCREASE, MARGIN_DETERIORATION, QUANTITY_REDUCTION, NEW_DISCOUNTED_LINE")
    reason: str
    baseline_value: Optional[float] = None
    proposed_value: Optional[float] = None
    field_name: Optional[str] = None
    line_id: Optional[int] = None
    product_name: Optional[str] = None


class InvalidationResult(BaseModel):
    """Result of material change evaluation against approved baseline."""
    is_material: bool
    reasons: List[str] = Field(default_factory=list)
    changes: List[MaterialChangeItem] = Field(default_factory=list)
    previous_approval_stage: ApprovalStage
    resulting_approval_stage: ApprovalStage
    approval_invalidated: bool = False
    details: Dict[str, Any] = Field(default_factory=dict)


class MaterialChangeDetector:
    """Detects commercial drift between approved state and new proposals."""

    def __init__(self, margin_drop_tolerance_pct: float = 0.5):
        self.margin_drop_tolerance_pct = margin_drop_tolerance_pct

    def detect_changes(
        self,
        approved_baseline: DealContext,
        proposed_state: DealContext
    ) -> List[MaterialChangeItem]:
        """Detect structured changes between approved baseline and proposed deal state."""
        changes: List[MaterialChangeItem] = []

        approved_lines_by_prod = {l.odoo_product_id: l for l in approved_baseline.lines}
        approved_lines_by_id = {l.odoo_line_id: l for l in approved_baseline.lines}

        for proposed_line in proposed_state.lines:
            approved_line = approved_lines_by_id.get(proposed_line.odoo_line_id) or \
                            approved_lines_by_prod.get(proposed_line.odoo_product_id)

            if approved_line is None:
                if proposed_line.discount_pct > 0:
                    changes.append(
                        MaterialChangeItem(
                            is_material=True,
                            change_type="NEW_DISCOUNTED_LINE",
                            field_name="discount_pct",
                            line_id=proposed_line.odoo_line_id,
                            product_name=proposed_line.product_name,
                            baseline_value=0.0,
                            proposed_value=proposed_line.discount_pct,
                            reason=(
                                f"New discounted product '{proposed_line.product_name}' added "
                                f"({proposed_line.discount_pct}% discount) after approval."
                            )
                        )
                    )
                continue

            # Check 1: Discount increase above approved level
            if round(proposed_line.discount_pct, 2) > round(approved_line.discount_pct, 2):
                diff = round(proposed_line.discount_pct - approved_line.discount_pct, 2)
                changes.append(
                    MaterialChangeItem(
                        is_material=True,
                        change_type="DISCOUNT_INCREASE",
                        field_name="discount_pct",
                        line_id=proposed_line.odoo_line_id,
                        product_name=proposed_line.product_name,
                        baseline_value=approved_line.discount_pct,
                        proposed_value=proposed_line.discount_pct,
                        reason=(
                            f"Discount on '{proposed_line.product_name}' increased from approved "
                            f"{approved_line.discount_pct}% to {proposed_line.discount_pct}% (+{diff}%)."
                        )
                    )
                )

            # Check 2: Quantity decrease while keeping high discount
            if proposed_line.quantity < approved_line.quantity and proposed_line.discount_pct > 0:
                changes.append(
                    MaterialChangeItem(
                        is_material=True,
                        change_type="QUANTITY_REDUCTION",
                        field_name="quantity",
                        line_id=proposed_line.odoo_line_id,
                        product_name=proposed_line.product_name,
                        baseline_value=approved_line.quantity,
                        proposed_value=proposed_line.quantity,
                        reason=(
                            f"Quantity for '{proposed_line.product_name}' reduced from {approved_line.quantity} "
                            f"to {proposed_line.quantity} while maintaining {proposed_line.discount_pct}% discount."
                        )
                    )
                )

        # Check 3: Margin deterioration
        baseline_margin = approved_baseline.totals.projected_margin_pct
        proposed_margin = proposed_state.totals.projected_margin_pct

        if baseline_margin > 0 and (baseline_margin - proposed_margin) > self.margin_drop_tolerance_pct:
            margin_diff = round(baseline_margin - proposed_margin, 2)
            changes.append(
                MaterialChangeItem(
                    is_material=True,
                    change_type="MARGIN_DETERIORATION",
                    field_name="projected_margin_pct",
                    baseline_value=baseline_margin,
                    proposed_value=proposed_margin,
                    reason=(
                        f"Overall projected deal margin dropped by {margin_diff}% "
                        f"(from approved {baseline_margin}% to {proposed_margin}%)."
                    )
                )
            )

        return changes

    def is_material_change(
        self,
        approved_baseline: DealContext,
        proposed_state: DealContext
    ) -> Tuple[bool, List[str]]:
        """Evaluate if proposed changes materially degrade commercial terms."""
        changes = self.detect_changes(approved_baseline, proposed_state)
        material_changes = [c for c in changes if c.is_material]
        reasons = [c.reason for c in material_changes]
        return len(material_changes) > 0, reasons

    def evaluate_invalidation(
        self,
        current_stage: ApprovalStage,
        approved_baseline: Optional[DealContext],
        proposed_state: DealContext
    ) -> InvalidationResult:
        """Evaluate if an approved deal must have its approval revoked."""
        if current_stage != ApprovalStage.APPROVED or approved_baseline is None:
            return InvalidationResult(
                is_material=False,
                reasons=[],
                changes=[],
                previous_approval_stage=current_stage,
                resulting_approval_stage=current_stage,
                approval_invalidated=False
            )

        changes = self.detect_changes(approved_baseline, proposed_state)
        material_changes = [c for c in changes if c.is_material]
        reasons = [c.reason for c in material_changes]
        is_material = len(material_changes) > 0

        if is_material:
            return InvalidationResult(
                is_material=True,
                reasons=reasons,
                changes=material_changes,
                previous_approval_stage=current_stage,
                resulting_approval_stage=ApprovalStage.INVALIDATED,
                approval_invalidated=True,
                details={"invalidated_by": "material_customer_negotiation", "violation_count": len(reasons)}
            )

        return InvalidationResult(
            is_material=False,
            reasons=[],
            changes=changes,
            previous_approval_stage=current_stage,
            resulting_approval_stage=current_stage,
            approval_invalidated=False
        )
