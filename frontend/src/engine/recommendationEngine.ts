import { AccretiveRecommendation, DealContext } from '../types';
import { CATALOG_PRODUCTS } from '../data/catalog';
import { calculateCommercialTotals } from './riskEngine';

export function getAccretiveRecommendations(deal: DealContext): AccretiveRecommendation[] {
  const currentProductIds = new Set(deal.lines.map((l) => l.productId));
  const currentTotals = calculateCommercialTotals(deal.lines);

  const candidates: AccretiveRecommendation[] = [];

  for (const product of CATALOG_PRODUCTS) {
    if (currentProductIds.has(product.id)) continue;

    const unitGrossMargin = product.unitPrice - product.costPrice;
    const marginPercent = (unitGrossMargin / product.unitPrice) * 100;

    // Hard filter: Exclude non-accretive or negative margin items
    if (marginPercent <= currentTotals.marginPercent) continue;

    // Recommended quantity logic:
    // If buying laptops, recommend matching docks
    const laptopLine = deal.lines.find((l) => l.productId === 'prod-laptop');
    const recommendedQty = product.id === 'prod-dock' && laptopLine ? laptopLine.quantity : 1;

    const totalAddedRevenue = product.unitPrice * recommendedQty;
    const totalAddedMargin = unitGrossMargin * recommendedQty;

    // Co-purchase affinity scoring
    let coPurchase = 40;
    if (product.id === 'prod-dock' && laptopLine) coPurchase = 95;
    if (product.id === 'prod-sec-audit' && deal.lines.some((l) => l.category === 'SERVICES')) coPurchase = 85;
    if (product.id === 'prod-ai-insights') coPurchase = 75;

    const promoScore = 70;
    const compositeScore = Math.round(0.5 * coPurchase + 0.3 * marginPercent + 0.2 * promoScore);

    let rationale = `High margin (${marginPercent.toFixed(0)}%) item adds +₹${totalAddedMargin.toLocaleString('en-IN')} gross margin.`;
    if (product.id === 'prod-dock' && laptopLine) {
      rationale = `Frequently paired with ${laptopLine.name}. Adding ${recommendedQty} units offsets discount concessions and lifts gross margin by +1.4%.`;
    } else if (product.id === 'prod-sec-audit') {
      rationale = `Enhances enterprise delivery credibility while contributing ₹1,02,000 pure margin.`;
    }

    candidates.push({
      id: `rec-${product.id}`,
      productId: product.id,
      productName: product.name,
      category: product.category,
      unitPrice: product.unitPrice,
      costPrice: product.costPrice,
      projectedMarginAmount: totalAddedMargin,
      projectedMarginPercent: marginPercent,
      coPurchaseAffinity: compositeScore,
      rationale,
      recommendedQty,
    });
  }

  // Rank by composite score descending
  return candidates.sort((a, b) => b.coPurchaseAffinity - a.coPurchaseAffinity);
}
