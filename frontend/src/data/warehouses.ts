import { WarehouseStock } from '../types';

export const WAREHOUSES: WarehouseStock[] = [
  {
    warehouseId: 'wh-main',
    warehouseName: 'Main Central Warehouse',
    locationCode: 'BOM-WH-01 (Mumbai)',
    availableQty: {
      'prod-laptop': 9, // Exactly 9 available, prompting a split when 10 are requested!
      'prod-dock': 45,
      'prod-setup': 999, // Services do not deplete physical stock
      'prod-db-tune': 999,
      'prod-sec-audit': 999,
      'prod-support': 999,
      'prod-saas-platform': 999,
      'prod-ai-insights': 999,
    },
  },
  {
    warehouseId: 'wh-east',
    warehouseName: 'East Regional Depot',
    locationCode: 'CCU-DP-02 (Kolkata)',
    availableQty: {
      'prod-laptop': 25,
      'prod-dock': 100,
      'prod-setup': 999,
      'prod-db-tune': 999,
      'prod-sec-audit': 999,
      'prod-support': 999,
      'prod-saas-platform': 999,
      'prod-ai-insights': 999,
    },
  },
];
