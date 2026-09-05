import { ApprovedBaseline, DealContext, LineItem } from '../types';
import { calculateCommercialTotals } from './riskEngine';

export interface InvalidationResult {
  isInvalidated: boolean;
  reasons: string[];
  discountCreepDetected: boolean;
  marginDegraded: boolean;
  deltaSummary: string;
}

export function detectMaterialInvalidation(
  baseline: ApprovedBaseline | null,
  currentLines: LineItem[]
): InvalidationResult {
  if (!baseline) {
    return {
      isInvalidated: false,
      reasons: [],
      discountCreepDetected: false,
      marginDegraded: false,
      deltaSummary: 'No prior approved baseline established.',
    };
  }

  const currentTotals = calculateCommercialTotals(currentLines);
  const reasons: string[] = [];
  let discountCreep = false;
  let marginDegraded = false;

  // 1. Check line-level discount creep
  for (const currentLine of currentLines) {
    const baselineLine = baseline.lines.find((b) => b.lineId === currentLine.id || b.productId === currentLine.productId);
    if (baselineLine) {
      if (currentLine.discountPercent > baselineLine.discountPercent + 0.01) {
        discountCreep = true;
        reasons.push(
          `${currentLine.name}: Discount increased from approved ${baselineLine.discountPercent.toFixed(1)}% to proposed ${currentLine.discountPercent.toFixed(1)}%.`
        );
      }
    }
  }

  // 2. Check overall margin degradation (> 0.5% margin drop)
  if (baseline.marginPercent - currentTotals.marginPercent > 0.5) {
    marginDegraded = true;
    reasons.push(
      `Gross margin deteriorated by ${(baseline.marginPercent - currentTotals.marginPercent).toFixed(1)}% (approved ${baseline.marginPercent.toFixed(1)}% → current ${currentTotals.marginPercent.toFixed(1)}%).`
    );
  }

  const isInvalidated = discountCreep || marginDegraded;

  return {
    isInvalidated,
    reasons,
    discountCreepDetected: discountCreep,
    marginDegraded,
    deltaSummary: isInvalidated 
      ? `Material commercial drift detected across ${reasons.length} metrics.` 
      : 'Commercial terms remain within approved baseline tolerances.',
  };
}
