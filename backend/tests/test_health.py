"""Unit tests for GOV-08 Deal Health & Anomaly Engine."""

from app.governance.health.calculator import DealHealthCalculator, HealthStatus


def test_healthy_deal(sample_compliant_deal):
    """Verify compliant, active deal has HEALTHY status."""
    calculator = DealHealthCalculator()
    result = calculator.calculate_health(sample_compliant_deal)

    assert result.status == HealthStatus.HEALTHY
    assert result.score <= 30
    assert result.is_stalled is False
    assert result.discount_anomaly is False


def test_stalled_deal_flagged(sample_compliant_deal):
    """Deal inactive for 8 days (> 5 days) must be flagged as stalled."""
    sample_compliant_deal.stalled_days = 8
    calculator = DealHealthCalculator()
    result = calculator.calculate_health(sample_compliant_deal)

    assert result.is_stalled is True
    assert result.stalled_days == 8
    assert any("stalled for 8 days" in r for r in result.reasons)
    assert result.score > 15


def test_discount_anomaly_detection(sample_gold_deal):
    """Deal with 18% discount when rep average is 8.5% must trigger anomaly alert."""
    calculator = DealHealthCalculator(rep_historical_avg_discount=8.5, anomaly_std_dev=4.0)
    result = calculator.calculate_health(sample_gold_deal)

    assert result.discount_anomaly is True
    assert any("Discount anomaly detected" in r for r in result.reasons)


def test_combined_stalled_and_anomaly_triggers_at_risk(sample_gold_deal):
    """Deal with both stalled status (10 days) and high discount is AT_RISK."""
    sample_gold_deal.stalled_days = 10
    calculator = DealHealthCalculator()
    result = calculator.calculate_health(sample_gold_deal, has_backorder=True)

    assert result.status == HealthStatus.AT_RISK
    assert result.score > 60
    assert result.is_stalled is True
    assert result.delivery_risk is True
