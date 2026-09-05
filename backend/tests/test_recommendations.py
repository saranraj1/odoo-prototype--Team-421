"""Unit tests for GOV-06 Recommendation Engine."""

from app.governance.recommendation.scorer import RecommendationScorer
from app.governance.interfaces import RecommendationCandidate, RecommendationProviderProtocol


class DummyRecommendationProvider:
    """Mock provider with controlled candidates including a loss-maker."""
    def get_candidates_for_lines(self, line_product_ids):
        return [
            RecommendationCandidate(
                odoo_product_id=99,
                product_name="Thunderbolt Docking Station",
                category_name="Hardware",
                price_unit=25000.0,
                cost_unit=12000.0,
                co_purchase_rate=0.68,
                promotion_weight=0.10,
                reason_template="68% of laptop deals include docking stations; increases margin by ₹13,000.",
            ),
            RecommendationCandidate(
                odoo_product_id=888,
                product_name="Negative Margin Freebie",
                category_name="Hardware",
                price_unit=5000.0,
                cost_unit=6000.0,  # Cost > Price -> Negative margin!
                co_purchase_rate=0.90,
                promotion_weight=0.50,
            ),
            RecommendationCandidate(
                odoo_product_id=105,
                product_name="2-Year Extended Support Plan",
                category_name="Services",
                price_unit=40000.0,
                cost_unit=15000.0,
                co_purchase_rate=0.45,
                promotion_weight=0.20,
            )
        ]


def test_docking_station_recommendation_ranking(sample_gold_deal):
    """Verify Thunderbolt Docking Station ranks #1 with correct margin delta."""
    scorer = RecommendationScorer(provider=DummyRecommendationProvider())
    result = scorer.generate_recommendations(sample_gold_deal, max_suggestions=2)

    assert len(result.recommendations) == 2

    top = result.recommendations[0]
    assert top.odoo_product_id == 99
    assert top.product_name == "Thunderbolt Docking Station"
    assert top.margin_delta == 13000.0
    assert top.score == 0.52 or top.score > 0.50
    assert "68% of laptop deals include docking stations" in top.reason


def test_negative_margin_products_filtered_out(sample_gold_deal):
    """Verify products with negative or zero margin delta are never recommended."""
    scorer = RecommendationScorer(provider=DummyRecommendationProvider())
    result = scorer.generate_recommendations(sample_gold_deal)

    # Candidate 888 has negative margin delta -> must NOT appear
    rec_ids = [r.odoo_product_id for r in result.recommendations]
    assert 888 not in rec_ids
