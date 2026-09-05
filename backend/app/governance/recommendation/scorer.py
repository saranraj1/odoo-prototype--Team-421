"""Recommendation Engine (GOV-06).

Computes deterministic, margin-accretive upsell and cross-sell suggestions.
Formula: Score = (co_purchase_rate * 0.5) + (margin_attractiveness * 0.3) + (promotion_weight * 0.2)
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from ..context import DealContext
from ..interfaces import RecommendationCandidate, RecommendationProviderProtocol, MockRecommendationProvider


class RecommendedProduct(BaseModel):
    """An individual ranked product recommendation."""
    odoo_product_id: int
    product_name: str
    category_name: str
    score: float = Field(description="Deterministic score between 0.0 and 1.0")
    price_unit: float
    margin_delta: float = Field(description="Projected net margin addition to the deal")
    reason: str


class RecommendationResult(BaseModel):
    """List of recommended products sorted by score."""
    recommendations: List[RecommendedProduct] = Field(default_factory=list)


class RecommendationScorer:
    """Deterministic recommendation engine optimizing deal margin and relevancy."""

    def __init__(self, provider: Optional[RecommendationProviderProtocol] = None):
        self.provider = provider or MockRecommendationProvider()

    def generate_recommendations(
        self,
        context: DealContext,
        max_suggestions: int = 3
    ) -> RecommendationResult:
        """Evaluate candidate products and return top accretive recommendations."""
        line_product_ids = set(line.odoo_product_id for line in context.lines)
        candidates = self.provider.get_candidates_for_lines(list(line_product_ids))

        scored: List[RecommendedProduct] = []
        seen_product_ids: set[int] = set()

        for cand in candidates:
            # 1. Prevent duplicate recommendations and already-added products
            if cand.odoo_product_id in line_product_ids or cand.odoo_product_id in seen_product_ids:
                continue

            seen_product_ids.add(cand.odoo_product_id)

            # 2. Filter out zero or negative margin items
            margin_delta = round(cand.price_unit - cand.cost_unit, 2)
            if margin_delta <= 0:
                continue

            # 3. Normalized input validation
            co_purchase = max(0.0, min(1.0, cand.co_purchase_rate))
            promo_weight = max(0.0, min(1.0, cand.promotion_weight))

            # Margin attractiveness normalized to [0, 1]
            margin_pct = (margin_delta / cand.price_unit) if cand.price_unit > 0 else 0.0
            margin_attractiveness = min(1.0, max(0.0, margin_pct))

            # 4. Deterministic scoring formula
            score = round(
                (co_purchase * 0.5) +
                (margin_attractiveness * 0.3) +
                (promo_weight * 0.2),
                2
            )

            reason = cand.reason_template or (
                f"Frequently paired with items in this quote; projected to add "
                f"₹{margin_delta:,.0f} in deal margin."
            )

            scored.append(
                RecommendedProduct(
                    odoo_product_id=cand.odoo_product_id,
                    product_name=cand.product_name,
                    category_name=cand.category_name,
                    score=score,
                    price_unit=cand.price_unit,
                    margin_delta=margin_delta,
                    reason=reason
                )
            )

        # 5. Deterministic tie-breaking: score desc, margin_delta desc, product_name asc
        scored.sort(key=lambda x: (-x.score, -x.margin_delta, x.product_name, x.odoo_product_id))
        return RecommendationResult(recommendations=scored[:max_suggestions])
