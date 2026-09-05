"""Blended Risk Engine (GOV-02).

Computes deterministic, explainable blended risk score from line-level discount excess,
projected margin exposure, multi-warehouse fulfillment split, and quote age.
"""

from typing import List, Optional
from ..context import DealContext
from ..policy.models import PolicyResolutionResult
from .factors import RiskFactor, RiskSeverity, RiskAssessmentResult


class RiskWeightConfig:
    """Configurable weights and thresholds for deterministic risk calculation."""
    def __init__(
        self,
        target_margin_pct: float = 20.0,
        margin_penalty_multiplier: float = 2.4,
        discount_excess_scale: float = 3.3,
        warehouse_split_penalty: int = 8,
        stalled_day_penalty: int = 4,
        low_threshold: int = 20,
        high_threshold: int = 50,
    ):
        self.target_margin_pct = target_margin_pct
        self.margin_penalty_multiplier = margin_penalty_multiplier
        self.discount_excess_scale = discount_excess_scale
        self.warehouse_split_penalty = warehouse_split_penalty
        self.stalled_day_penalty = stalled_day_penalty
        self.low_threshold = low_threshold
        self.high_threshold = high_threshold


class BlendedRiskCalculator:
    """Deterministic blended risk calculator producing structured explanations."""

    def __init__(self, config: Optional[RiskWeightConfig] = None):
        self.config = config or RiskWeightConfig()

    def calculate_risk(
        self,
        context: DealContext,
        policy_result: PolicyResolutionResult,
        split_required: bool = False
    ) -> RiskAssessmentResult:
        """Calculate the 0-100 risk score and generate explainability factors."""
        factors: List[RiskFactor] = []
        if context.totals.amount_untaxed == 0 and len(context.lines) > 0:
            context.recalculate_totals()

        quote_total = max(1.0, context.totals.amount_untaxed)

        # 1. Line-Level Discount Excess Contribution
        total_discount_risk = 0.0
        for line_res in policy_result.line_results:
            if line_res.is_violation:
                # Find the matching line context to get subtotal
                line_ctx = next((l for l in context.lines if l.odoo_line_id == line_res.odoo_line_id), None)
                subtotal = line_ctx.subtotal if line_ctx else 1000.0
                value_weight = subtotal / quote_total

                # Normalized excess ratio: excess / (allowed + 1)
                excess_ratio = line_res.excess / (line_res.effective_ceiling + 1.0)
                raw_line_risk = excess_ratio * value_weight * 100.0
                scaled_points = round(raw_line_risk * self.config.discount_excess_scale)
                scaled_points = max(5, min(45, scaled_points))

                total_discount_risk += scaled_points
                factors.append(
                    RiskFactor(
                        type="DISCOUNT_EXCESS",
                        raw_value=line_res.excess,
                        contribution=int(scaled_points),
                        reason=(
                            f"{line_res.product_name} discount ({line_res.actual_discount}%) exceeds "
                            f"{line_res.category_name} ceiling ({line_res.effective_ceiling}%) by {line_res.excess}%"
                        ),
                        metadata={"odoo_line_id": line_res.odoo_line_id, "ceiling": line_res.effective_ceiling}
                    )
                )

        discount_points = int(min(50, total_discount_risk))

        # 2. Projected Deal Margin Exposure Contribution
        actual_margin = context.totals.projected_margin_pct
        margin_points = 0
        if actual_margin < self.config.target_margin_pct:
            margin_gap = round(self.config.target_margin_pct - actual_margin, 2)
            margin_points = int(min(30, round(margin_gap * self.config.margin_penalty_multiplier)))
            if margin_points > 0:
                factors.append(
                    RiskFactor(
                        type="MARGIN_EXPOSURE",
                        raw_value=actual_margin,
                        contribution=margin_points,
                        reason=(
                            f"Projected deal margin ({actual_margin}%) is below "
                            f"target threshold ({self.config.target_margin_pct}%)"
                        ),
                        metadata={"target_margin": self.config.target_margin_pct, "margin_gap": margin_gap}
                    )
                )

        # 3. Fulfillment / Warehouse Split Risk
        fulfillment_points = 0
        if split_required:
            fulfillment_points = self.config.warehouse_split_penalty
            factors.append(
                RiskFactor(
                    type="FULFILLMENT_SPLIT",
                    raw_value=float(fulfillment_points),
                    contribution=fulfillment_points,
                    reason="Order requires multi-warehouse split",
                    metadata={"split_required": True}
                )
            )

        # 4. Inactivity / Stalled Deal Risk
        delay_points = 0
        if context.stalled_days > 5:
            stalled_excess_days = context.stalled_days - 5
            delay_points = int(min(20, stalled_excess_days * self.config.stalled_day_penalty))
            if delay_points > 0:
                factors.append(
                    RiskFactor(
                        type="STALLED_QUOTE",
                        raw_value=float(context.stalled_days),
                        contribution=delay_points,
                        reason=f"Quotation has been inactive for {context.stalled_days} days without progression",
                        metadata={"stalled_days": context.stalled_days}
                    )
                )

        # Sum and bound score to [0, 100]
        raw_score = discount_points + margin_points + fulfillment_points + delay_points
        score = max(0, min(100, raw_score))

        # Determine severity
        if score < self.config.low_threshold:
            severity = RiskSeverity.LOW
        elif score <= self.config.high_threshold:
            severity = RiskSeverity.MEDIUM
        else:
            severity = RiskSeverity.HIGH

        return RiskAssessmentResult(
            score=score,
            severity=severity,
            factors=factors,
            discount_risk_points=discount_points,
            margin_risk_points=margin_points,
            fulfillment_risk_points=fulfillment_points,
            delay_risk_points=delay_points
        )
