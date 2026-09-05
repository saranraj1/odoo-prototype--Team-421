export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
    portalMe: ['portal', 'me'] as const,
  },
  deals: {
    all: ['deals'] as const,
    list: (filters: Record<string, any>) => ['deals', 'list', filters] as const,
    pipeline: ['deals', 'pipeline'] as const,
    workspace: (id: string) => ['deals', 'workspace', id] as const,
    detail: (id: string) => ['deals', 'detail', id] as const,
    timeline: (id: string) => ['deals', 'timeline', id] as const,
    assessments: (id: string) => ['deals', 'assessments', id] as const,
    billing: (id: string) => ['deals', 'billing', id] as const,
  },
  approvals: {
    inbox: ['approvals', 'inbox'] as const,
    list: (filters: Record<string, any>) => ['approvals', 'list', filters] as const,
  },
  controlTower: {
    summary: ['control-tower', 'summary'] as const,
  },
  alerts: {
    list: (filters: Record<string, any>) => ['alerts', 'list', filters] as const,
  },
  fulfillment: {
    exceptions: ['fulfillment', 'exceptions'] as const,
  },
  subscriptions: {
    list: (filters: Record<string, any>) => ['subscriptions', 'list', filters] as const,
  },
  invoices: {
    list: (filters: Record<string, any>) => ['invoices', 'list', filters] as const,
    detail: (id: number) => ['invoices', 'detail', id] as const,
  },
  products: {
    list: (filters: Record<string, any>) => ['products', 'list', filters] as const,
    detail: (id: number) => ['products', 'detail', id] as const,
    categories: ['products', 'categories'] as const,
  },
  partners: {
    list: (query: string) => ['partners', 'list', query] as const,
  },
  warehouses: {
    list: (withStock?: boolean) => ['warehouses', 'list', { withStock }] as const,
  },
  reports: {
    summary: (filters: Record<string, any>) => ['reports', 'summary', filters] as const,
    deals: (filters: Record<string, any>) => ['reports', 'deals', filters] as const,
    risk: (filters: Record<string, any>) => ['reports', 'risk', filters] as const,
    approvals: (filters: Record<string, any>) => ['reports', 'approvals', filters] as const,
  },
  config: {
    tiers: ['config', 'tiers'] as const,
    policies: ['config', 'policies'] as const,
    settings: ['config', 'settings'] as const,
    warehouses: ['config', 'warehouses'] as const,
    recommendationRules: ['config', 'recommendation-rules'] as const,
    users: ['config', 'users'] as const,
    odooHealth: ['config', 'odoo-health'] as const,
    jobs: ['config', 'jobs'] as const,
    outbox: ['config', 'outbox'] as const,
  },
  notifications: {
    unread: ['notifications', 'unread'] as const,
  },
  portal: {
    deals: ['portal', 'deals'] as const,
    deal: (id: string) => ['portal', 'deal', id] as const,
    billing: (id: string) => ['portal', 'billing', id] as const,
    messages: ['portal', 'messages'] as const,
  },
};
