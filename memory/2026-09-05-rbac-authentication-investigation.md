# Debug & Architecture Report: Enterprise Role-Based Authentication & Demo Decoupling

- **Date**: 2026-09-05
- **Investigation**: `/gstack-openclaw-investigate`
- **Topic**: Real-World Role-Based Access Control (RBAC), UI Demo Controls Removal, and Credentials Isolation

---

## 1. Symptom
The login screens (`/login` and `/portal/login`) had prefilled test account credentials, 1-click quick login buttons ("Default Test Accounts", "Enterprise Roles (Auto-Redirects)", "Quick Demo Role Selectors"), and a floating "Golden Demo Runner" widget (`DemoControls.tsx`). Furthermore, authentication had loose mock fallbacks that accepted arbitrary inputs and auto-defaulted to `rep1` or `portalAcme`, rather than acting like a real-world secure enterprise application.

## 2. Root Cause
1. `frontend/src/features/auth/LoginPage.tsx` had state initialized with `'rep1@dealflow.test'` and `'Password123!'`, plus a 5-button 1-click login toolbar and a fallback catch block that forcefully logged in users regardless of invalid passwords.
2. `frontend/src/features/portal/PortalLoginPage.tsx` had state initialized with `'buyer@acme.test'` and `'Password123!'`, plus two 1-click role selector groups for internal and customer personas.
3. `frontend/src/app/layouts/InternalLayout.tsx` rendered the floating `DemoControls.tsx` runner on internal screens.
4. Authentication handlers in `frontend/src/mocks/handlers.ts` did not strictly compare passwords and defaulted unmatched credentials to mock users rather than returning 401 Unauthorized.
5. `frontend/src/api/client.ts` had a global 401 redirect that triggered a page refresh loop during legitimate login credential validation failures.

## 3. Fixes & Changes Applied
1. **`frontend/src/api/client.ts`**:
   - Guarded 401 automatic redirection to skip paths containing `/auth/login` and `/portal/auth/login`.
   - Enhanced API error extraction to bubble up specific error messages from server envelopes (`AUTH_FAILED`, invalid password, etc.).
2. **`frontend/src/mocks/fixtures/users.ts`**:
   - Added additional verified customer accounts (`portalBeta` / `buyer@beta.test`, `portalGamma` / `buyer@gamma.test`).
   - Merged stored users with initial mock users so all seeded roles are consistently present.
3. **`frontend/src/mocks/handlers.ts`**:
   - Enforced strict credential checks in `*/api/v1/auth/login` and `*/api/v1/portal/auth/login`.
   - Invalid username or incorrect password now returns status 401 with standard envelope `{ error: { code: 'AUTH_FAILED', message: 'Invalid email or password. Please check your credentials.' } }`.
4. **`frontend/src/features/auth/LoginPage.tsx`**:
   - Initialized `login` and `password` to empty strings `''`.
   - Replaced demo placeholders with standard `name@company.com` and `••••••••`.
   - Removed `handleQuickLogin` and the 1-click test login buttons block.
   - Removed loose fallback catch block; now displays real authentication failure messages.
5. **`frontend/src/features/portal/PortalLoginPage.tsx`**:
   - Initialized `login` and `password` to empty strings `''`.
   - Removed `handleRoleQuickLogin`, `handleCustomerQuickLogin`, and the demo role selectors block.
   - Enforced strict error reporting.
6. **`frontend/src/app/layouts/InternalLayout.tsx`**:
   - Removed `DemoControls` and `{DEMO_MODE && <DemoControls />}`.
7. **`CREDENTIALS.md`**:
   - Created comprehensive root reference markdown file documenting all enterprise personas, customer accounts, passwords, RBAC permissions, and multi-tier approval authority.

## 4. Evidence & Verification
- **Automated RBAC Test Suite (`scripts/test-auth-rbac.mjs`)**:
  - 11/11 tests passed: Admin, Sales Manager, Finance Director, Sales Rep, wrong password rejection, unknown user rejection, customer portal logins, internal recognition, customer self-registration & subsequent login.
- **Automated Button Endpoints Test Suite (`scripts/test-button-endpoints.mjs`)**:
  - 16/16 tests passed.
- **Frontend Build & Lint**:
  - `npm run build`: Exit code 0 (all chunks built successfully).
  - `npm run lint`: Exit code 0 (0 errors).

## 5. Status
**DONE**. Real-world authentication and RBAC is fully active, all UI demo artifacts and buttons have been removed, and credentials are exclusively documented in `CREDENTIALS.md`.
