"""Risk explainability formatter."""

from typing import List
from .factors import RiskAssessmentResult, RiskSeverity


class RiskExplainer:
    """Formats explainable risk summaries for UI and executive reporting."""

    @staticmethod
    def generate_narrative(assessment: RiskAssessmentResult) -> str:
        """Generate a human-readable one-paragraph explanation of the deal risk."""
        if assessment.severity == RiskSeverity.LOW:
            return "Deal is commercially compliant with standard margins and healthy operational delivery."

        if not assessment.factors:
            return f"Deal flagged as {assessment.severity.value} risk with an overall risk score of {assessment.score}."

        top_factors = sorted(assessment.factors, key=lambda f: f.contribution, reverse=True)
        primary = top_factors[0]

        summary = f"Flagged as {assessment.severity.value} risk (Score {assessment.score}/100). Primary driver: {primary.reason}."
        if len(top_factors) > 1:
            secondary = top_factors[1]
            summary += f" Secondary driver: {secondary.reason}."

        return summary
