"""Policy Resolution Engine (GOV-01).

Implements deterministic policy evaluation.
Rule: effective_discount_ceiling = MIN(customer_tier_ceiling, category_ceiling)
"""

from typing import List, Optional, Dict
from ..context import DealContext, DealLineContext
from .models import DiscountPolicy, LinePolicyResult, PolicyResolutionResult, PolicyReasonCode


# Standard defaults if policies are not configured in DB
DEFAULT_TIER_LIMITS: Dict[str, float] = {
    "Bronze": 5.0,
    "Silver": 10.0,
    "Gold": 15.0,
    "Platinum": 20.0,
}

DEFAULT_CATEGORY_LIMITS: Dict[str, float] = {
    "Hardware": 15.0,
    "Services": 10.0,
    "Subscriptions": 12.0,
    "Software": 20.0,
}


class PolicyResolver:
    """Deterministic policy resolution engine."""

    def __init__(self, custom_policies: Optional[List[DiscountPolicy]] = None):
        self.policies = [p for p in (custom_policies or []) if p.active]

    def resolve_effective_limits(
        self,
        customer_tier: str,
        category_name: str,
        category_id: Optional[int] = None
    ) -> tuple[float, float, float]:
        """Resolve (customer_tier_limit, category_limit, effective_ceiling).

        Effective ceiling is MIN(tier_limit, category_limit).
        Deterministic tie-breaking prioritizes higher priority, then policy name, then ID.
        """
        tier_limit: Optional[float] = None
        category_limit: Optional[float] = None

        # 1. Search custom policies with deterministic secondary sort
        sorted_policies = sorted(
            self.policies,
            key=lambda x: (-x.priority, x.name or "", x.id or "")
        )

        for p in sorted_policies:
            if p.customer_tier and p.customer_tier.lower() == customer_tier.lower():
                if tier_limit is None:
                    tier_limit = p.max_discount_pct

            if (p.odoo_category_id and category_id and p.odoo_category_id == category_id) or \
               (p.category_name and p.category_name.lower() == category_name.lower()):
                if category_limit is None:
                    category_limit = p.max_discount_pct

        # 2. Fall back to defaults if not found in custom policies
        if tier_limit is None:
            tier_limit = DEFAULT_TIER_LIMITS.get(customer_tier, 5.0)

        if category_limit is None:
            category_limit = DEFAULT_CATEGORY_LIMITS.get(category_name, 10.0)

        # 3. Apply strictest ceiling rule: MIN(tier, category)
        effective_ceiling = min(tier_limit, category_limit)
        return tier_limit, category_limit, effective_ceiling

    def evaluate_line(
        self,
        line: DealLineContext,
        customer_tier: str
    ) -> LinePolicyResult:
        """Evaluate an individual quotation line against effective policy."""
        tier_limit, cat_limit, ceiling = self.resolve_effective_limits(
            customer_tier=customer_tier,
            category_name=line.category_name,
            category_id=line.odoo_category_id
        )

        actual_discount = round(line.discount_pct, 2)
        excess = max(0.0, round(actual_discount - ceiling, 2))
        is_violation = excess > 0.0

        if is_violation:
            code = PolicyReasonCode.DISCOUNT_EXCESS.value
            reason = (
                f"{line.product_name} discount ({actual_discount}%) exceeds "
                f"{line.category_name} ceiling ({ceiling}%) by {excess}% "
                f"(Customer tier allows {tier_limit}%, category allows {cat_limit}%)."
            )
        elif actual_discount == ceiling:
            code = PolicyReasonCode.EXACT_CEILING.value
            reason = (
                f"{line.product_name} discount ({actual_discount}%) exactly reaches "
                f"allowed policy ceiling ({ceiling}%)."
            )
        else:
            code = PolicyReasonCode.COMPLIANT.value
            reason = (
                f"{line.product_name} discount ({actual_discount}%) is within "
                f"allowed policy ceiling ({ceiling}%)."
            )

        return LinePolicyResult(
            odoo_line_id=line.odoo_line_id,
            product_name=line.product_name,
            category_name=line.category_name,
            customer_tier=customer_tier,
            customer_tier_limit=tier_limit,
            category_limit=cat_limit,
            effective_ceiling=ceiling,
            actual_discount=actual_discount,
            excess=excess,
            is_violation=is_violation,
            code=code,
            reason=reason
        )

    def resolve_policy(self, context: DealContext) -> PolicyResolutionResult:
        """Resolve policy compliance across all deal lines."""
        results: List[LinePolicyResult] = []
        has_violations = False
        max_excess = 0.0
        violations_count = 0

        customer_tier = context.customer.tier or "Bronze"

        for line in context.lines:
            res = self.evaluate_line(line, customer_tier)
            results.append(res)
            if res.is_violation:
                has_violations = True
                violations_count += 1
                if res.excess > max_excess:
                    max_excess = res.excess

        return PolicyResolutionResult(
            line_results=results,
            has_violations=has_violations,
            max_excess=max_excess,
            violations_count=violations_count
        )
