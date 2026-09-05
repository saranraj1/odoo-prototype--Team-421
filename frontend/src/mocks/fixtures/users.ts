export interface UserAccountData {
  id: number;
  odoo_user_id: number;
  name: string;
  role: 'ADMIN' | 'SALES_MANAGER' | 'SALES_REP' | 'FINANCE' | 'FINANCE_DIRECTOR' | 'CUSTOMER';
  username?: string;
  aliases?: string[];
  email: string;
  password?: string;
  team_id?: number | null;
  company_id: number;
  company_name?: string;
  partner_id?: number;
  is_active: boolean;
}

export const INITIAL_MOCK_USERS: Record<string, UserAccountData> = {
  admin: {
    id: 1,
    odoo_user_id: 1,
    name: 'System Admin',
    role: 'ADMIN',
    username: 'admin',
    aliases: ['admin', 'administrator', 'system.admin', 'sysadmin'],
    email: 'admin@dealflow.test',
    password: 'Password123!',
    company_id: 1,
    company_name: 'DealFlow Enterprise Inc',
    is_active: true,
  },
  manager1: {
    id: 2,
    odoo_user_id: 2,
    name: 'Sales Manager North',
    role: 'SALES_MANAGER',
    username: 'sales.manager',
    aliases: ['manager1', 'sales.manager', 'manager', 'sunita', 'sunita.sharma'],
    team_id: 1,
    email: 'manager1@dealflow.test',
    password: 'Password123!',
    company_id: 1,
    company_name: 'DealFlow Enterprise Inc',
    is_active: true,
  },
  rep1: {
    id: 4,
    odoo_user_id: 4,
    name: 'Sales Rep One',
    role: 'SALES_REP',
    username: 'sales.rep',
    aliases: ['rep1', 'sales.rep', 'rep', 'rahul', 'rahul.verma'],
    team_id: 1,
    email: 'rep1@dealflow.test',
    password: 'Password123!',
    company_id: 1,
    company_name: 'DealFlow Enterprise Inc',
    is_active: true,
  },
  finance: {
    id: 6,
    odoo_user_id: 6,
    name: 'Finance Director',
    role: 'FINANCE',
    username: 'finance',
    aliases: ['finance', 'finance.director', 'vikram', 'vikram.mehta'],
    email: 'finance@dealflow.test',
    password: 'Password123!',
    company_id: 1,
    company_name: 'DealFlow Enterprise Inc',
    is_active: true,
  },
  portalAcme: {
    id: 10,
    odoo_user_id: 10,
    partner_id: 1,
    name: 'Acme Buyer (Alice Johnson)',
    role: 'CUSTOMER',
    username: 'buyer.acme',
    aliases: ['buyer', 'buyer.acme', 'acme', 'alice'],
    email: 'buyer@acme.test',
    password: 'Password123!',
    company_id: 1,
    company_name: 'Acme Corp',
    is_active: true,
  },
  portalBeta: {
    id: 11,
    odoo_user_id: 11,
    partner_id: 2,
    name: 'Beta Buyer (Bob Smith)',
    role: 'CUSTOMER',
    username: 'buyer.beta',
    aliases: ['beta', 'buyer.beta', 'bob'],
    email: 'buyer@beta.test',
    password: 'Password123!',
    company_id: 1,
    company_name: 'Beta Industries',
    is_active: true,
  },
  portalGamma: {
    id: 12,
    odoo_user_id: 12,
    partner_id: 3,
    name: 'Nova Buyer (Carol Danvers)',
    role: 'CUSTOMER',
    username: 'buyer.gamma',
    aliases: ['gamma', 'buyer.gamma', 'carol', 'nova'],
    email: 'buyer@gamma.test',
    password: 'Password123!',
    company_id: 1,
    company_name: 'Nova Retail',
    is_active: true,
  },
};

const STORAGE_USERS_KEY = 'dealflow_mock_users_v1';

export function getStoredUsers(): Record<string, UserAccountData> {
  if (typeof window === 'undefined') return INITIAL_MOCK_USERS;
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...INITIAL_MOCK_USERS, ...parsed };
    }
  } catch {}
  return INITIAL_MOCK_USERS;
}

export function saveStoredUsers(users: Record<string, UserAccountData>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch {}
}

export const MOCK_USERS = getStoredUsers();
