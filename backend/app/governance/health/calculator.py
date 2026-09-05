"""Deal Health Engine (GOV-08).

Monitors deal velocity, inactivity, and commercial anomalies.
Scores deal health (0-100) and classifies into HEALTHY, WATCH, or AT_RISK.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from ..context import DealContext
from ..risk.factors import RiskAssessmentResult


class HealthStatus(str, Enum):
    HEALTHY = "HEALTHY"
    WATCH = "WATCH"
    AT_RISK = "AT_RISK"


class HealthFlag(BaseModel):
    """An explicit indicator of deal health risk."""
    type: str = Field(description="STALLED_DEAL, DISCOUNT_ANOMALY, DELIVERY_RISK, GOVERNANCE_RISK")
    severity: str = Field(description="LOW, MEDIUM, HIGH")
    reason: str


class DealHealthResult(BaseModel):
    """Consolidated deal health score and anomaly flags."""
    score: int = Field(ge=0, le=100, description="Health penalty score (0 = Perfect health, 100 = Severe risk)")
    status: HealthStatus
    stalled_days: int
    is_stalled: bool = False
    discount_anomaly: bool = False
    delivery_risk: bool = False
    reasons: List[str] = Field(default_factory=list)
    flags: List[HealthFlag] = Field(default_factory=list)


class DealHealthCalculator:
    """Calculates deterministic deal health indicators."""

    def __init__(self, rep_historical_avg_discount: float = 8.5, anomaly_std_dev: float = 4.0):
        self.rep_avg = rep_historical_avg_discount
        self.anomaly_cutoff = rep_historical_avg_discount + (2.0 * anomaly_std_dev)  # ~16.5%

    def calculate_health(
        self,
        context: DealContext,
        risk_result: Optional[RiskAssessmentResult] = None,
        has_backorder: bool = False
    ) -> DealHealthResult:
        """Evaluate deal health metrics."""
        score_penalty = 0
        reasons: List[str] = []
        flags: List[HealthFlag] = []

        # 1. Stalled Quote Detection (> 5 days inactive)
        is_stalled = context.stalled_days > 5
        if is_stalled:
            stalled_penalty = min(35, (context.stalled_days - 5) * 6)
            score_penalty += stalled_penalty
            reason = f"Quotation has stalled for {context.stalled_days} days without customer interaction."
            reasons.append(reason)
            flags.append(
                HealthFlag(
                    type="STALLED_DEAL",
                    severity="HIGH" if context.stalled_days > 10 else "MEDIUM",
                    reason=reason
                )
            )

        # 2. Discount Anomaly (> 2 standard deviations above rep historical average)
        max_discount = max((line.discount_pct for line in context.lines), default=0.0)
        discount_anomaly = max_discount > self.anomaly_cutoff
        if discount_anomaly:
            score_penalty += 25
            excess_over_norm = round(max_discount - self.rep_avg, 1)
            reason = (
                f"Discount anomaly detected: Max discount ({max_discount}%) is "
                f"{excess_over_norm}% above the rep's historical average ({self.rep_avg}%)."
            )
            reasons.append(reason)
            flags.append(
                HealthFlag(
                    type="DISCOUNT_ANOMALY",
                    severity="HIGH",
                    reason=reason
                )
            )

        # 3. Delivery / Fulfillment Risk
        if has_backorder:
            score_penalty += 15
            reason = "Fulfillment risk: Warehouse stock deficit requires partial backorder."
            reasons.append(reason)
            flags.append(
                HealthFlag(
                    type="DELIVERY_RISK",
                    severity="MEDIUM",
                    reason=reason
                )
            )

        # 4. Integrate Governance Risk Score
        if risk_result and risk_result.score > 50:
            gov_penalty = int((risk_result.score - 50) * 0.5)
            score_penalty += gov_penalty
            reason = f"High governance risk score ({risk_result.score}/100) requires executive oversight."
            reasons.append(reason)
            flags.append(
                HealthFlag(
                    type="GOVERNANCE_RISK",
                    severity="HIGH",
                    reason=reason
                )
            )

        total_penalty = max(0, min(100, score_penalty))

        # Status Classification
        if total_penalty <= 30:
            status = HealthStatus.HEALTHY
        elif total_penalty <= 60:
            status = HealthStatus.WATCH
        else:
            status = HealthStatus.AT_RISK

        return DealHealthResult(
            score=total_penalty,
            status=status,
            stalled_days=context.stalled_days,
            is_stalled=is_stalled,
            discount_anomaly=discount_anomaly,
            delivery_risk=has_backorder,
            reasons=reasons,
            flags=flags
        )
