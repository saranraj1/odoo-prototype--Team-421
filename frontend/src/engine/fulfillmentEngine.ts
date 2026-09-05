import { AllocationLine, FulfillmentPlan, LineItem } from '../types';
import { WAREHOUSES } from '../data/warehouses';

export function calculateFulfillmentPlan(dealId: string, lines: LineItem[]): FulfillmentPlan {
  const mainStock = WAREHOUSES.find((w) => w.warehouseId === 'wh-main')!;
  const eastStock = WAREHOUSES.find((w) => w.warehouseId === 'wh-east')!;

  const allocationLines: AllocationLine[] = [];
  let splitRequired = false;
  let backorderRequired = false;

  for (const line of lines) {
    if (line.category === 'SERVICES' || line.category === 'SUBSCRIPTION') {
      // Intangibles don't require physical warehouse allocation
      allocationLines.push({
        productId: line.productId,
        productName: line.name,
        requestedQty: line.quantity,
        allocatedFromMain: line.quantity,
        allocatedFromEast: 0,
        backorderQty: 0,
      });
      continue;
    }

    const availableMain = mainStock.availableQty[line.productId] ?? 0;
    const availableEast = eastStock.availableQty[line.productId] ?? 0;

    const fromMain = Math.min(line.quantity, availableMain);
    const remainderAfterMain = line.quantity - fromMain;

    const fromEast = Math.min(remainderAfterMain, availableEast);
    const backorder = remainderAfterMain - fromEast;

    if (fromMain > 0 && fromEast > 0) {
      splitRequired = true;
    }
    if (backorder > 0) {
      backorderRequired = true;
    }

    allocationLines.push({
      productId: line.productId,
      productName: line.name,
      requestedQty: line.quantity,
      allocatedFromMain: fromMain,
      allocatedFromEast: fromEast,
      backorderQty: backorder,
    });
  }

  let status: FulfillmentPlan['status'] = 'OPTIMAL';
  let shipmentCount = 1;
  let estimatedShippingCost = 3500;

  if (backorderRequired) {
    status = 'BACKORDER_REQUIRED';
    shipmentCount = splitRequired ? 3 : 2;
    estimatedShippingCost = 9800;
  } else if (splitRequired) {
    status = 'SPLIT_REQUIRED';
    shipmentCount = 2;
    estimatedShippingCost = 7200; // Exact ₹7,200 as required in demo specification
  }

  return {
    dealId,
    status,
    shipmentCount,
    estimatedShippingCost,
    lines: allocationLines,
    isManuallyOverridden: false,
  };
}
