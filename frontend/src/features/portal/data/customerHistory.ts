export interface HistoricalOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  total: number;
}

export interface CustomerHistoricalOrder {
  id: string;
  orderNumber: string;
  odooReference: string;
  date: string;
  quarter: string;
  year: number;
  status: 'DELIVERED' | 'FULFILLED' | 'NEGOTIATION' | 'COMPLETED';
  statusLabel: string;
  items: HistoricalOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  invoiceNumber?: string;
  paymentStatus: 'PAID' | 'PENDING';
  deliveryWarehouse: string;
  trackingNumber?: string;
}

export interface CustomerProfileSummary {
  partnerId: number;
  name: string;
  tierCode: string;
  tierDescription: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingWarehouse: string;
  paymentTerms: string;
  lifetimeSpend: number;
  totalOrders: number;
  activeContracts: number;
  avgOrderValue: number;
  relationshipAge: string;
}

export const ACME_CUSTOMER_PROFILE: CustomerProfileSummary = {
  partnerId: 1,
  name: 'Acme Corp',
  tierCode: 'GOLD',
  tierDescription: 'Preferred Enterprise Tier · 10% Volume Discount',
  email: 'buyer@acme.test',
  phone: '+1 (555) 349-2900',
  billingAddress: '400 Technology Way, Suite 800, San Francisco, CA 94105',
  shippingWarehouse: 'East Coast Distribution Center (WH2)',
  paymentTerms: 'Net 30 Days',
  lifetimeSpend: 2480000,
  totalOrders: 4,
  activeContracts: 1,
  avgOrderValue: 620000,
  relationshipAge: '12 Months (Since Q4 2025)',
};

export const ACME_SPEND_OVER_TIME = [
  { period: 'Q4 2025', quarter: '2025-Q4', spend: 320000, units: 16, orders: 1, label: 'Initial Laptop Fleet' },
  { period: 'Q1 2026', quarter: '2026-Q1', spend: 922000, units: 40, orders: 1, label: 'Dev Workstation Refresh' },
  { period: 'Q2 2026', quarter: '2026-Q2', spend: 680000, units: 45, orders: 1, label: 'Peripherals & Monitors' },
  { period: 'Q3 2026', quarter: '2026-Q3', spend: 558000, units: 12, orders: 1, label: 'Current Proposal (D-1024)' },
];

export const ACME_HISTORICAL_ORDERS: CustomerHistoricalOrder[] = [
  {
    id: 'deal_d1024_acme',
    orderNumber: 'D-1024',
    odooReference: 'S00012',
    date: '2026-09-05',
    quarter: 'Q3 2026',
    year: 2026,
    status: 'NEGOTIATION',
    statusLabel: 'Under Negotiation',
    items: [
      { id: 'item-1', name: 'Laptop Pro 14"', quantity: 10, unitPrice: 50000, discountPct: 12, total: 440000 },
      { id: 'item-2', name: 'Setup Service', quantity: 1, unitPrice: 100000, discountPct: 18, total: 82000 },
      { id: 'item-3', name: 'Premium Support (Monthly)', quantity: 1, unitPrice: 20000, discountPct: 10, total: 18000 },
    ],
    subtotal: 540000,
    tax: 18000,
    total: 558000,
    currency: 'INR',
    paymentStatus: 'PENDING',
    deliveryWarehouse: 'Main Warehouse (WH1)',
    trackingNumber: 'PENDING DISPATCH',
  },
  {
    id: 'ord_2026_06_12',
    orderNumber: 'D-1018',
    odooReference: 'S00009',
    date: '2026-06-12',
    quarter: 'Q2 2026',
    year: 2026,
    status: 'DELIVERED',
    statusLabel: 'Delivered & Invoiced',
    items: [
      { id: 'item-4', name: 'Standard 27" 4K Monitor', quantity: 15, unitPrice: 25000, discountPct: 10, total: 337500 },
      { id: 'item-5', name: 'Universal Docking Station', quantity: 15, unitPrice: 15000, discountPct: 10, total: 202500 },
      { id: 'item-6', name: 'Ergonomic Wireless Keyboard & Mouse', quantity: 15, unitPrice: 8000, discountPct: 5, total: 114000 },
    ],
    subtotal: 654000,
    tax: 26000,
    total: 680000,
    currency: 'INR',
    invoiceNumber: 'INV-2026-0042',
    paymentStatus: 'PAID',
    deliveryWarehouse: 'East Depot (WH2)',
    trackingNumber: 'TRK-8829-EAST',
  },
  {
    id: 'ord_2026_01_18',
    orderNumber: 'D-1004',
    odooReference: 'S00004',
    date: '2026-01-18',
    quarter: 'Q1 2026',
    year: 2026,
    status: 'COMPLETED',
    statusLabel: 'Fulfilled & Closed',
    items: [
      { id: 'item-7', name: 'Developer Workstation Ultra', quantity: 20, unitPrice: 40000, discountPct: 10, total: 720000 },
      { id: 'item-8', name: 'High-Speed Gigabit Switch 24-Port', quantity: 20, unitPrice: 8500, discountPct: 0, total: 170000 },
    ],
    subtotal: 890000,
    tax: 32000,
    total: 922000,
    currency: 'INR',
    invoiceNumber: 'INV-2026-0019',
    paymentStatus: 'PAID',
    deliveryWarehouse: 'Main Warehouse (WH1)',
    trackingNumber: 'TRK-7410-MAIN',
  },
  {
    id: 'ord_2025_10_04',
    orderNumber: 'D-0982',
    odooReference: 'S00001',
    date: '2025-10-04',
    quarter: 'Q4 2025',
    year: 2025,
    status: 'COMPLETED',
    statusLabel: 'Fulfilled & Closed',
    items: [
      { id: 'item-9', name: 'Laptop Pro 14"', quantity: 8, unitPrice: 45000, discountPct: 15, total: 306000 },
      { id: 'item-10', name: 'Executive Laptop Sleeve', quantity: 8, unitPrice: 2500, discountPct: 10, total: 14000 },
    ],
    subtotal: 320000,
    tax: 0,
    total: 320000,
    currency: 'INR',
    invoiceNumber: 'INV-2025-0188',
    paymentStatus: 'PAID',
    deliveryWarehouse: 'Main Warehouse (WH1)',
    trackingNumber: 'TRK-6102-MAIN',
  },
];
