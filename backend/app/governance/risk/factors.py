"""Risk factors and models."""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RiskSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RiskFactor(BaseModel):
    """An individual contributor to the overall deal risk score."""
    type: str = Field(description="DISCOUNT_EXCESS, MARGIN_EXPOSURE, FULFILLMENT_SPLIT, STALLED_QUOTE, etc.")
    raw_value: float = Field(default=0.0, description="The measured value (e.g. 8% excess, 13.8% margin)")
    contribution: int = Field(description="Points contributed to total risk score (0-100)")
    reason: str = Field(description="Human-readable business explanation")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RiskAssessmentResult(BaseModel):
    """Consolidated deterministic risk assessment."""
    score: int = Field(ge=0, le=100, description="Overall risk score between 0 and 100")
    severity: RiskSeverity
    factors: List[RiskFactor] = Field(default_factory=list)
    discount_risk_points: int = 0
    margin_risk_points: int = 0
    fulfillment_risk_points: int = 0
    delay_risk_points: int = 0
