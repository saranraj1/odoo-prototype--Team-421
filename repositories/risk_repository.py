# -*- coding: utf-8 -*-
"""
Risk Assessment Repository
Author: Person 1 (DB Architect)
"""

from typing import Optional, List, Dict, Any
import uuid
from db.contracts import RiskAssessmentDTO, RiskFactorDTO
from db.connection import get_db_cursor


class RiskRepository:
    def __init__(self, connection_pool=None):
        self.pool = connection_pool

    def save_assessment(self, assessment: RiskAssessmentDTO) -> str:
        """
        Atomically saves a RiskAssessment and all child RiskFactors.
        Preserves complete historical explainability.
        """
        assessment_id = assessment.id or str(uuid.uuid4())
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO risk_assessment
                       (id, deal_id, risk_score, severity, decision,
                        trigger_type, policy_version)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (assessment_id, assessment.deal_id, assessment.risk_score,
                 assessment.severity, assessment.decision,
                 assessment.trigger_type, assessment.policy_version)
            )
            for factor in assessment.factors:
                factor_id = factor.id or str(uuid.uuid4())
                cur.execute(
                    """INSERT INTO risk_factor
                           (id, risk_assessment_id, factor_type, source_reference,
                            raw_value, weight, contribution, reason)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (factor_id, assessment_id, factor.factor_type,
                     factor.source_reference, factor.raw_value,
                     factor.weight, factor.contribution, factor.reason)
                )
        return assessment_id

    def get_latest_assessment(self, deal_id: str) -> Optional[RiskAssessmentDTO]:
        """Fetch the most recent calculated risk assessment with explainable factors."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, risk_score, severity, decision,
                          trigger_type, policy_version, calculated_at
                   FROM risk_assessment
                   WHERE deal_id = %s
                   ORDER BY calculated_at DESC
                   LIMIT 1""",
                (deal_id,)
            )
            row = cur.fetchone()
            if not row:
                return None

            assessment_id = str(row['id'])

            # Fetch child factors
            cur.execute(
                """SELECT id, risk_assessment_id, factor_type, source_reference,
                          raw_value, weight, contribution, reason
                   FROM risk_factor
                   WHERE risk_assessment_id = %s""",
                (assessment_id,)
            )
            factor_rows = cur.fetchall()
            factors = [
                RiskFactorDTO(
                    id=str(f['id']),
                    risk_assessment_id=str(f['risk_assessment_id']),
                    factor_type=f['factor_type'],
                    source_reference=f['source_reference'],
                    raw_value=float(f['raw_value']),
                    weight=float(f['weight']),
                    contribution=float(f['contribution']),
                    reason=f['reason']
                )
                for f in factor_rows
            ]

            return RiskAssessmentDTO(
                id=assessment_id,
                deal_id=str(row['deal_id']),
                risk_score=float(row['risk_score']),
                severity=row['severity'],
                decision=row['decision'],
                trigger_type=row['trigger_type'],
                policy_version=row['policy_version'],
                calculated_at=row['calculated_at'],
                factors=factors
            )

    def get_assessment_history(self, deal_id: str) -> List[RiskAssessmentDTO]:
        """Fetch complete chronological risk assessment history for audit."""
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT id, deal_id, risk_score, severity, decision,
                          trigger_type, policy_version, calculated_at
                   FROM risk_assessment
                   WHERE deal_id = %s
                   ORDER BY calculated_at DESC""",
                (deal_id,)
            )
            assessment_rows = cur.fetchall()
            results = []
            for row in assessment_rows:
                assessment_id = str(row['id'])
                cur.execute(
                    """SELECT id, risk_assessment_id, factor_type, source_reference,
                              raw_value, weight, contribution, reason
                       FROM risk_factor
                       WHERE risk_assessment_id = %s""",
                    (assessment_id,)
                )
                factor_rows = cur.fetchall()
                factors = [
                    RiskFactorDTO(
                        id=str(f['id']),
                        risk_assessment_id=str(f['risk_assessment_id']),
                        factor_type=f['factor_type'],
                        source_reference=f['source_reference'],
                        raw_value=float(f['raw_value']),
                        weight=float(f['weight']),
                        contribution=float(f['contribution']),
                        reason=f['reason']
                    )
                    for f in factor_rows
                ]
                results.append(RiskAssessmentDTO(
                    id=assessment_id,
                    deal_id=str(row['deal_id']),
                    risk_score=float(row['risk_score']),
                    severity=row['severity'],
                    decision=row['decision'],
                    trigger_type=row['trigger_type'],
                    policy_version=row['policy_version'],
                    calculated_at=row['calculated_at'],
                    factors=factors
                ))
            return results
