import { setupServer } from 'msw/node';
import { handlers } from '../src/mocks/handlers.ts';

const server = setupServer(...handlers);
server.listen({ onUnhandledRequest: 'error' });

async function runAuthTests() {
  console.log('Testing Real-World Role-Based Authentication & Access Control...\n');
  let passed = 0;
  let failed = 0;

  async function testCase(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Enterprise Login: Admin
  await testCase('Enterprise Login: System Admin (admin@dealflow.test)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'admin@dealflow.test', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.user?.role !== 'ADMIN') throw new Error(`Expected role ADMIN, got ${json.data?.user?.role}`);
    if (!json.data?.access_token) throw new Error('Missing access_token');
  });

  // 2. Enterprise Login: Sales Manager
  await testCase('Enterprise Login: Sales Manager (manager1@dealflow.test)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'manager1@dealflow.test', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.user?.role !== 'SALES_MANAGER') throw new Error(`Expected SALES_MANAGER, got ${json.data?.user?.role}`);
  });

  // 3. Enterprise Login: Finance Director
  await testCase('Enterprise Login: Finance Director (finance@dealflow.test)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'finance@dealflow.test', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.user?.role !== 'FINANCE') throw new Error(`Expected FINANCE, got ${json.data?.user?.role}`);
  });

  // 4. Enterprise Login: Sales Rep (by email)
  await testCase('Enterprise Login: Sales Rep by email (rep1@dealflow.test)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'rep1@dealflow.test', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.user?.role !== 'SALES_REP') throw new Error(`Expected SALES_REP, got ${json.data?.user?.role}`);
  });

  // 4b. Enterprise Login: Sales Rep (by username "sales.rep")
  await testCase('Enterprise Login: Sales Rep by username ("sales.rep")', async () => {
    const res = await fetch('http://localhost:5173/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'sales.rep', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.user?.role !== 'SALES_REP') throw new Error(`Expected SALES_REP, got ${json.data?.user?.role}`);
  });

  // 4c. Enterprise Login: Sales Manager by username ("sales.manager")
  await testCase('Enterprise Login: Sales Manager by username ("sales.manager")', async () => {
    const res = await fetch('http://localhost:5173/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'sales.manager', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.user?.role !== 'SALES_MANAGER') throw new Error(`Expected SALES_MANAGER, got ${json.data?.user?.role}`);
  });

  // 4d. Enterprise Login: Admin by username ("admin")
  await testCase('Enterprise Login: Admin by username ("admin")', async () => {
    const res = await fetch('http://localhost:5173/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'admin', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.user?.role !== 'ADMIN') throw new Error(`Expected ADMIN, got ${json.data?.user?.role}`);
  });

  // 5. Enterprise Login: Wrong Password Rejection
  await testCase('Security: Rejects incorrect password with 401', async () => {
    const res = await fetch('http://localhost:5173/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'admin@dealflow.test', password: 'WrongPassword999!' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    const json = await res.json();
    if (json.error?.code !== 'AUTH_FAILED') throw new Error(`Expected AUTH_FAILED code, got ${json.error?.code}`);
  });

  // 6. Enterprise Login: Unknown User Rejection
  await testCase('Security: Rejects unknown email with 401', async () => {
    const res = await fetch('http://localhost:5173/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'stranger@nowhere.com', password: 'Password123!' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 7. Customer Portal Login: Acme Corp
  await testCase('Portal Login: Acme Corp Buyer (buyer@acme.test)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/portal/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'buyer@acme.test', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.is_internal !== false) throw new Error('Customer should have is_internal = false');
    if (!json.data?.partner?.name?.includes('Acme')) throw new Error(`Expected Acme partner name, got ${json.data?.partner?.name}`);
  });

  // 8. Customer Portal Login: Beta Industries
  await testCase('Portal Login: Beta Industries (buyer@beta.test)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/portal/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'buyer@beta.test', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.is_internal !== false) throw new Error('Customer should have is_internal = false');
  });

  // 9. Customer Portal Login: Internal Team Recognition
  await testCase('Portal Login: Automatically routes internal role (manager1@dealflow.test)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/portal/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'manager1@dealflow.test', password: 'Password123!' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.is_internal !== true) throw new Error('Internal user must have is_internal = true');
    if (json.data?.user?.role !== 'SALES_MANAGER') throw new Error('Expected SALES_MANAGER user object');
  });

  // 10. Portal Security: Wrong Password Rejection
  await testCase('Portal Security: Rejects incorrect customer password with 401', async () => {
    const res = await fetch('http://localhost:5173/api/v1/portal/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'buyer@acme.test', password: 'BadPassword!' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 11. Customer Self-Registration & Subsequent Login
  await testCase('Real-World Onboarding: Customer Sign Up & Login with New Credentials', async () => {
    const uniqueEmail = `procurement_${Date.now()}@delta-corp.com`;
    const newPass = 'DeltaSecurePass2026!';
    
    // Register
    const regRes = await fetch('http://localhost:5173/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: 'Delta Corp International',
        contact_name: 'Diana Prince',
        email: uniqueEmail,
        password: newPass,
      }),
    });
    if (!regRes.ok) throw new Error(`Registration failed with status ${regRes.status}`);
    const regJson = await regRes.json();
    if (!regJson.data?.access_token) throw new Error('Missing token on signup');

    // Authenticate with new credentials
    const loginRes = await fetch('http://localhost:5173/api/v1/portal/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: uniqueEmail, password: newPass }),
    });
    if (!loginRes.ok) throw new Error(`Login failed for new user: ${loginRes.status}`);
    const loginJson = await loginRes.json();
    if (loginJson.data?.user?.email !== uniqueEmail) throw new Error('User email mismatch on login');
  });

  // 12. Segregation of Duties (SoD): Admin CANNOT approve deals (Expect 403 Forbidden)
  await testCase('SoD: Admin blocked from approving commercial quotation (HTTP 403)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/deals/deal_d1024_acme/approval/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_admin_user_admin_01',
      },
      body: JSON.stringify({ reason: 'Admin override attempt' }),
    });
    if (res.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for Admin approval, got ${res.status}`);
    }
    const json = await res.json();
    if (!json.error?.message?.includes('Segregation of Duties')) {
      throw new Error(`Expected SoD message, got: ${JSON.stringify(json)}`);
    }
  });

  // 13. Segregation of Duties (SoD): Sales Rep CANNOT approve deals (Expect 403 Forbidden)
  await testCase('SoD: Sales Rep blocked from self-approving quotation (HTTP 403)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/deals/deal_d1024_acme/approval/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_sales_rep_user_rep_01',
      },
      body: JSON.stringify({ reason: 'Rep self-approval attempt' }),
    });
    if (res.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for Sales Rep approval, got ${res.status}`);
    }
  });

  // 14. Segregation of Duties: Sales Manager CAN approve Stage 1
  await testCase('SoD: Sales Manager approves Stage 1 -> moves to PENDING_FINANCE', async () => {
    const res = await fetch('http://localhost:5173/api/v1/deals/deal_d1024_acme/approval/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_sales_manager_user_mgr_01',
      },
      body: JSON.stringify({ reason: 'Margin and pricing verified for Acme' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.approval?.state !== 'PENDING_FINANCE') {
      throw new Error(`Expected PENDING_FINANCE, got ${json.data?.approval?.state}`);
    }
  });

  // 15. Segregation of Duties: Sales Manager CANNOT approve Stage 2 (Expect 400 Bad Request)
  await testCase('SoD: Sales Manager cannot approve Stage 2 (Finance required, HTTP 400)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/deals/deal_d1024_acme/approval/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_sales_manager_user_mgr_01',
      },
      body: JSON.stringify({ reason: 'Manager attempting Stage 2' }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected HTTP 400 Bad Request, got ${res.status}`);
    }
  });

  // 16. Segregation of Duties: Finance Director approves Stage 2 -> moves to APPROVED
  await testCase('SoD: Finance Director approves Stage 2 -> APPROVED', async () => {
    const res = await fetch('http://localhost:5173/api/v1/deals/deal_d1024_acme/approval/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_finance_user_fin_01',
      },
      body: JSON.stringify({ reason: 'Payment terms Net 30 confirmed and capital protected' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();
    if (json.data?.approval?.state !== 'APPROVED') {
      throw new Error(`Expected APPROVED, got ${json.data?.approval?.state}`);
    }
  });

  // 17. Segregation of Duties: Admin CANNOT reject deals (Expect 403 Forbidden)
  await testCase('SoD: Admin blocked from rejecting commercial quotation (HTTP 403)', async () => {
    const res = await fetch('http://localhost:5173/api/v1/deals/deal_d1024_acme/approval/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock_jwt_admin_user_admin_01',
      },
      body: JSON.stringify({ reason: 'Admin reject attempt' }),
    });
    if (res.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden, got ${res.status}`);
    }
  });

  server.close();

  console.log(`\n================================`);
  console.log(`RBAC Auth Results: ${passed} Passed, ${failed} Failed`);
  console.log(`================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthTests().catch((err) => {
  console.error('Fatal error running auth test suite:', err);
  process.exit(1);
});
