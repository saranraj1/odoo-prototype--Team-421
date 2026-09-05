"""Recommendation engine package (GOV-06)."""

from .scorer import RecommendationScorer, RecommendationResult, RecommendedProduct

__all__ = [
    "RecommendationScorer",
    "RecommendationResult",
    "RecommendedProduct",
]
