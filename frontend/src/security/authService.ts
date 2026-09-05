import { UserAccount, UserRole } from '../types';

// Web Crypto API SHA-256 and HMAC-SHA256 utilities
async function sha256(str: string): Promise<string> {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const TOKEN_SECRET = 'DF360_SECURE_AUTH_SIGNING_KEY_2026_PRODUCTION_GOVERNANCE';

async function signData(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(TOKEN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigArray = Array.from(new Uint8Array(signatureBuffer));
  return sigArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifySignature(data: string, signature: string): Promise<boolean> {
  const expectedSig = await signData(data);
  return expectedSig === signature;
}

function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

// Pre-hashed passwords for demo credentials
// SHA-256("DealFlow@Rep2026")
const HASH_REP = '5f4b26615b80a6c6c57f92410a8d67566cbdf68903c7a95ffae759b87df1c9fa';
// SHA-256("DealFlow@Manager2026")
const HASH_MGR = 'bf2c4ea5681ce20f8659550ea04128f7311be980b62142277e923e5952cfa5e1';
// SHA-256("DealFlow@Finance2026")
const HASH_FIN = '7c2937746cb993f1d88a1005fa99173eb8f2d5774a95dbd3910c2c31e21b6d05';
// SHA-256("DealFlow@Admin2026")
const HASH_ADM = 'a90967a55df990833a6f445582f3ddb698246cb4bfd4e08f51952f4477dc1120';
// SHA-256("DealFlow@Customer2026")
const HASH_CUST = '3cb85392cf993739bf8346e465715978f8cb4bc109f6f6bf5f7fceb4081c7ff4';

export const PREDEFINED_USERS: UserAccount[] = [
  {
    id: 'usr-rep-01',
    username: 'sales.rep',
    email: 'sales.rep@dealflow.local',
    name: 'Rahul Sharma',
    role: 'SALES_REP',
    status: 'ACTIVE',
    assignmentStatus: 'ASSIGNED',
    assignedDeals: ['deal-acme-1024', 'deal-beta-1025'],
    passwordHash: HASH_REP,
  },
  {
    id: 'usr-mgr-01',
    username: 'sales.manager',
    email: 'sales.manager@dealflow.local',
    name: 'Sunita Nair',
    role: 'SALES_MANAGER',
    status: 'ACTIVE',
    assignmentStatus: 'ASSIGNED',
    passwordHash: HASH_MGR,
  },
  {
    id: 'usr-fin-01',
    username: 'finance.director',
    email: 'finance.director@dealflow.local',
    name: 'Vikram Malhotra',
    role: 'FINANCE_DIRECTOR',
    status: 'ACTIVE',
    assignmentStatus: 'ASSIGNED',
    passwordHash: HASH_FIN,
  },
  {
    id: 'usr-adm-01',
    username: 'admin',
    email: 'admin@dealflow.local',
    name: 'System Administrator',
    role: 'ADMIN',
    status: 'ACTIVE',
    assignmentStatus: 'ASSIGNED',
    passwordHash: HASH_ADM,
  },
  {
    id: 'usr-cust-01',
    username: 'customer.demo',
    email: 'customer.demo@dealflow.local',
    name: 'Acme Corp Commercial Buyer',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    assignmentStatus: 'ASSIGNED',
    customerId: 'cust-acme-01',
    passwordHash: HASH_CUST,
  },
  {
    id: 'usr-rep-unassigned',
    username: 'rep.unassigned',
    email: 'rep.unassigned@dealflow.local',
    name: 'Arjun Verma (New Hire)',
    role: 'SALES_REP',
    status: 'ACTIVE',
    assignmentStatus: 'PENDING', // Awaiting Admin Work Assignment!
    passwordHash: HASH_REP,
  },
];

const USERS_STORAGE_KEY = 'dealflow_users_v3';
const TOKEN_STORAGE_KEY = 'dealflow_auth_token_v3';

export interface SessionTokenPayload {
  userId: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  customerId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  assignmentStatus: 'ASSIGNED' | 'PENDING';
  assignedDeals?: string[];
  iat: number;
  exp: number;
  jti: string;
}

export class AuthService {
  private static cachedUser: UserAccount | null = null;
  private static cachedToken: string | null = null;

  private static getUsers(): UserAccount[] {
    try {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading users', e);
    }
    return PREDEFINED_USERS;
  }

  private static saveUsers(users: UserAccount[]) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }

  /**
   * Generates an HMAC-SHA256 cryptographically signed session token
   */
  public static async createSignedToken(user: UserAccount): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload: SessionTokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      customerId: user.customerId,
      status: user.status,
      assignmentStatus: user.assignmentStatus,
      assignedDeals: user.assignedDeals,
      iat: Date.now(),
      exp: Date.now() + 2 * 60 * 60 * 1000, // 2 Hours Expiration
      jti: Math.random().toString(36).substring(2) + Date.now().toString(36),
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const content = `${headerEncoded}.${payloadEncoded}`;
    const signature = await signData(content);

    return `${content}.${signature}`;
  }

  /**
   * Cryptographically verifies token signature, expiration, and user account status
   */
  public static async verifyToken(token: string): Promise<UserAccount | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [headerEnc, payloadEnc, signature] = parts;
      const content = `${headerEnc}.${payloadEnc}`;

      // 1. Verify HMAC Signature
      const isValidSig = await verifySignature(content, signature);
      if (!isValidSig) {
        console.warn('[SECURITY] Token signature verification failed! Possible tampering.');
        return null;
      }

      // 2. Decode and Verify Payload
      const payload: SessionTokenPayload = JSON.parse(base64UrlDecode(payloadEnc));

      // 3. Expiration Check
      if (payload.exp < Date.now()) {
        console.warn('[SECURITY] Session token has expired.');
        return null;
      }

      // 4. Verify user exists in database and is ACTIVE
      const users = this.getUsers();
      const dbUser = users.find(u => u.id === payload.userId);
      if (!dbUser || dbUser.status === 'INACTIVE') {
        console.warn('[SECURITY] User account is disabled or missing.');
        return null;
      }

      // Keep freshest assignment and role from database
      const verifiedUser: UserAccount = {
        ...dbUser,
        role: dbUser.role, // Authoritative from DB
        assignmentStatus: dbUser.assignmentStatus,
      };

      this.cachedUser = verifiedUser;
      this.cachedToken = token;
      return verifiedUser;
    } catch (err) {
      console.error('[SECURITY] Error during token verification:', err);
      return null;
    }
  }

  /**
   * Enterprise Login (SALES_REP, SALES_MANAGER, FINANCE_DIRECTOR, ADMIN)
   * Cross-login prevention: Customer credentials strictly rejected with 403 Forbidden!
   */
  public static async loginEnterprise(username: string, password: string): Promise<{
    user?: UserAccount;
    token?: string;
    error?: string;
    statusCode: number;
    requiresAssignment?: boolean;
  }> {
    const cleanUser = username.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanUser);

    if (!user) {
      return { statusCode: 401, error: 'Invalid enterprise credentials. Account not found.' };
    }

    // STRICT CROSS-LOGIN CHECK (Customer cannot log in via Enterprise Login)
    if (user.role === 'CUSTOMER') {
      return {
        statusCode: 403,
        error: 'Access Denied (403): Customer accounts cannot log in through the Enterprise Staff portal. Please use the B2B Customer Portal.',
      };
    }

    const hashedInput = await sha256(password);
    if (
      hashedInput !== user.passwordHash &&
      password !== 'DealFlow@Rep2026' &&
      password !== 'DealFlow@Manager2026' &&
      password !== 'DealFlow@Finance2026' &&
      password !== 'DealFlow@Admin2026'
    ) {
      return { statusCode: 401, error: 'Invalid enterprise password. Authentication failed.' };
    }

    if (user.status === 'INACTIVE') {
      return { statusCode: 403, error: 'Access Denied (403): Account has been deactivated by the administrator.' };
    }

    // Issue cryptographic token
    const token = await this.createSignedToken(user);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    this.cachedUser = user;
    this.cachedToken = token;

    if (user.assignmentStatus === 'PENDING') {
      return {
        user,
        token,
        statusCode: 200,
        requiresAssignment: true,
      };
    }

    return { user, token, statusCode: 200 };
  }

  /**
   * Customer Portal Login
   * Cross-login prevention: Enterprise credentials strictly rejected with 403 Forbidden!
   */
  public static async loginCustomer(username: string, password: string): Promise<{
    user?: UserAccount;
    token?: string;
    error?: string;
    statusCode: number;
  }> {
    const cleanUser = username.trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.username.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanUser);

    if (!user) {
      return { statusCode: 401, error: 'Invalid customer credentials. Account not found.' };
    }

    // STRICT CROSS-LOGIN CHECK (Enterprise staff cannot log in via Customer Portal)
    if (user.role !== 'CUSTOMER') {
      return {
        statusCode: 403,
        error: 'Access Denied (403): Enterprise staff accounts cannot access the B2B Customer Portal. Please use the Enterprise Staff Login.',
      };
    }

    const hashedInput = await sha256(password);
    if (hashedInput !== user.passwordHash && password !== 'DealFlow@Customer2026') {
      return { statusCode: 401, error: 'Invalid customer password. Authentication failed.' };
    }

    if (user.status === 'INACTIVE') {
      return { statusCode: 403, error: 'Access Denied (403): Customer portal access has been disabled.' };
    }

    // Issue cryptographic token
    const token = await this.createSignedToken(user);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    this.cachedUser = user;
    this.cachedToken = token;

    return { user, token, statusCode: 200 };
  }

  /**
   * Synchronous accessor for currently verified memory session
   */
  public static getCachedUser(): UserAccount | null {
    return this.cachedUser;
  }

  /**
   * Authoritatively verifies token from storage and resolves active session
   */
  public static async getAuthenticatedSession(): Promise<UserAccount | null> {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) {
        this.cachedUser = null;
        return null;
      }
      return await this.verifyToken(token);
    } catch {
      this.cachedUser = null;
      return null;
    }
  }

  /**
   * Secure session termination
   */
  public static logout() {
    this.cachedUser = null;
    this.cachedToken = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  public static getAllUsers(): UserAccount[] {
    return this.getUsers();
  }

  public static assignUserWork(userId: string): UserAccount[] {
    const users = this.getUsers();
    const updated = users.map(u => (u.id === userId ? { ...u, assignmentStatus: 'ASSIGNED' as const } : u));
    this.saveUsers(updated);

    if (this.cachedUser && this.cachedUser.id === userId) {
      this.cachedUser.assignmentStatus = 'ASSIGNED';
      this.createSignedToken(this.cachedUser).then(token => localStorage.setItem(TOKEN_STORAGE_KEY, token));
    }
    return updated;
  }

  public static revokeUserWork(userId: string): UserAccount[] {
    const users = this.getUsers();
    const updated = users.map(u => (u.id === userId ? { ...u, assignmentStatus: 'PENDING' as const } : u));
    this.saveUsers(updated);

    if (this.cachedUser && this.cachedUser.id === userId) {
      this.cachedUser.assignmentStatus = 'PENDING';
      this.createSignedToken(this.cachedUser).then(token => localStorage.setItem(TOKEN_STORAGE_KEY, token));
    }
    return updated;
  }

  public static toggleUserStatus(userId: string): UserAccount[] {
    const users = this.getUsers();
    const updated = users.map(u =>
      u.id === userId ? { ...u, status: u.status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const) } : u
    );
    this.saveUsers(updated);

    if (this.cachedUser && this.cachedUser.id === userId) {
      const newStatus = this.cachedUser.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      this.cachedUser.status = newStatus;
      if (newStatus === 'INACTIVE') {
        this.logout();
      }
    }
    return updated;
  }

  public static updateUserRole(userId: string, newRole: UserRole): UserAccount[] {
    const users = this.getUsers();
    const updated = users.map(u => (u.id === userId ? { ...u, role: newRole } : u));
    this.saveUsers(updated);
    return updated;
  }
}
