import { ProductCategory } from '../types';

export interface CatalogProduct {
  id: string;
  name: string;
  code: string;
  category: ProductCategory;
  unitPrice: number;
  costPrice: number;
  description: string;
  isSubscription?: boolean;
  billingPeriod?: 'MONTHLY' | 'ANNUAL' | 'ONE_TIME';
}

export const CATALOG_PRODUCTS: CatalogProduct[] = [
  {
    id: 'prod-laptop',
    name: 'Enterprise Core Laptop 16" Pro',
    code: 'HW-LAP-16',
    category: 'HARDWARE',
    unitPrice: 120000,
    costPrice: 84000,
    description: 'High-performance developer workstation with 32GB RAM & 1TB NVMe',
  },
  {
    id: 'prod-dock',
    name: 'Thunderbolt 4 Smart Docking Station',
    code: 'HW-DCK-TB4',
    category: 'HARDWARE',
    unitPrice: 18000,
    costPrice: 6500,
    description: 'Dual 4K display output, 120W power delivery, multi-port hub',
  },
  {
    id: 'prod-setup',
    name: 'Cloud Architecture Setup & Migration',
    code: 'SRV-CLD-MIG',
    category: 'SERVICES',
    unitPrice: 80000,
    costPrice: 22000,
    description: 'Turnkey cloud environment setup, network security hardening and data migration',
  },
  {
    id: 'prod-db-tune',
    name: 'Database Performance Optimization',
    code: 'SRV-DB-OPT',
    category: 'SERVICES',
    unitPrice: 65000,
    costPrice: 18000,
    description: 'PostgreSQL indexing audit, query plan tuning and read-replica configuration',
  },
  {
    id: 'prod-sec-audit',
    name: 'Enterprise SOC2 Compliance Audit',
    code: 'SRV-SEC-SOC2',
    category: 'SERVICES',
    unitPrice: 150000,
    costPrice: 48000,
    description: 'Full-spectrum security vulnerability testing and compliance remediation pack',
  },
  {
    id: 'prod-support',
    name: '24/7 Mission-Critical SLA Support',
    code: 'SUB-SUP-247',
    category: 'SUBSCRIPTION',
    unitPrice: 20000,
    costPrice: 3800,
    description: 'Guaranteed 15-minute response SLA with dedicated TAM and weekend coverage',
    isSubscription: true,
    billingPeriod: 'MONTHLY',
  },
  {
    id: 'prod-saas-platform',
    name: 'DealFlow Enterprise Cloud License',
    code: 'SUB-LIC-ENT',
    category: 'SUBSCRIPTION',
    unitPrice: 50000,
    costPrice: 6000,
    description: 'Unlimited user seats, advanced policy automation and ERP real-time syncing',
    isSubscription: true,
    billingPeriod: 'MONTHLY',
  },
  {
    id: 'prod-ai-insights',
    name: 'Predictive Sales Analytics Add-on',
    code: 'SFT-AI-ANL',
    category: 'SOFTWARE',
    unitPrice: 45000,
    costPrice: 5000,
    description: 'Embedded churn prediction and automatic cross-sell intelligence engine',
  },
];
