# DealFlow360 Frontend Architecture & Implementation Specification

> **Core Directive**: *"Odoo owns the transaction; DealFlow governs the transaction."*

---

## 1. Architectural Overview

DealFlow360 is an enterprise-grade B2B Sales Governance and Decision-Support platform built on React 18, Vite, TypeScript, Tailwind CSS, TanStack React Query, and Zustand. It operates as an intelligence and governance layer on top of Odoo 18 Community Edition, consuming FastAPI REST endpoints at `/api/v1` while leaving transaction persistence and core accounting to Odoo.

### Key Architectural Tenets
1. **Zero-Trust Portal Isolation**: The Customer Portal (`/portal/*`) and Internal Sales Operations (`/*`) run in completely isolated contexts with separate authentication stores, distinct layout shells, and a runtime JSON whitelist sanitizer that strips all margin, cost, risk, and approval metadata before rendering.
2. **Deterministic UI State**: All server state is managed through TanStack React Query with predictable query keys, structured caching, and granular mutation invalidations.
3. **Resilient Offline Demonstration**: An integrated Mock Service Worker (MSW) engine simulates all 30+ backend endpoints, complete with mutable in-memory state representing the golden deal `deal_d1024_acme` (Acme Corp).
4. **Strict Resource Governance**: Single-worker test execution (`--pool=forks --poolOptions.forks.maxForks=1`) to eliminate memory bloat and background zombie processes.

---

## 2. Directory Structure

```
d:/odoo/frontend/
├── index.html
├── package.json
├── playwright.config.ts
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── docs/
│   └── FRONTEND_ARCHITECTURE.md
├── src/
│   ├── api/
│   │   ├── client.ts              # Fetch wrapper, bearer auth, error normalization
│   │   ├── queryKeys.ts           # Hierarchical query key definitions
│   │   ├── types.ts               # Strict TypeScript domain models & API envelopes
│   │   └── endpoints/             # Typed REST resource callers
│   │       ├── approvals.ts
│   │       ├── auth.ts
│   │       ├── billing.ts
│   │       ├── config.ts
│   │       ├── deals.ts
│   │       ├── fulfillment.ts
│   │       ├── health.ts
│   │       ├── negotiation.ts
│   │       ├── notifications.ts
│   │       ├── portal.ts
│   │       ├── products.ts
│   │       └── reports.ts
│   ├── app/
│   │   ├── App.tsx
│   │   ├── providers.tsx          # QueryClientProvider, TooltipProvider
│   │   └── router.tsx             # React Router 6 data router with guards
│   ├── components/
│   │   ├── data/                  # Reusable domain display primitives
│   │   │   ├── CapabilityMissingState.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── ForbiddenState.tsx
│   │   │   ├── HealthBadge.tsx
│   │   │   ├── HintStrip.tsx
│   │   │   ├── KpiCard.tsx
│   │   │   ├── NextBestActionBar.tsx
│   │   │   ├── RiskBadge.tsx
│   │   │   ├── StatusChip.tsx
│   │   │   ├── Stepper.tsx
│   │   │   └── Timeline.tsx
│   │   ├── layout/                # Shells & persistent navigation
│   │   │   ├── AuthLayout.tsx
│   │   │   ├── DemoControls.tsx
│   │   │   ├── InternalLayout.tsx
│   │   │   ├── NotificationsDrawer.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── PortalLayout.tsx
│   │   │   └── TopNav.tsx
│   │   └── ui/                    # Headless Radix-compatible atoms
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── skeleton.tsx
│   │       └── textarea.tsx
│   ├── features/                  # Domain feature modules
│   │   ├── approvals/             # List, Detail, DecisionModal
│   │   ├── auth/                  # LoginPage, ForgotPasswordDialog, authStore
│   │   ├── billing/               # Subscriptions, Invoices, BillingDetail, Payments
│   │   ├── config/                # Policy settings, tiers, thresholds
│   │   ├── dashboard/             # Rep, Manager Control Tower, Finance Ops
│   │   ├── fulfillment/           # Split routing, manual override, backorder consolidation
│   │   ├── guardian/              # GuardianPanel, InvalidationBanner, Assessments
│   │   ├── health/                # DealHealth, AlertActionModal
│   │   ├── portal/                # Zero-trust customer portal & counter offers
│   │   ├── products/              # Catalog & Detail views
│   │   ├── quotations/            # List, Kanban, NewQuote, Workspace, LinesTable
│   │   └── reports/               # Executive BI, charts, filters
│   ├── lib/
│   │   ├── constants.ts           # Feature flags, roles, thresholds
│   │   ├── format.ts              # formatMoney, formatPct, formatRelativeDate
│   │   ├── rbac.ts                # Route permission matrices & navigation tabs
│   │   └── utils.ts               # cn (clsx + twMerge)
│   ├── mocks/                     # MSW mock server for browser & tests
│   │   ├── browser.ts
│   │   ├── handlers.ts
│   │   ├── state.ts
│   │   └── fixtures/              # Seed fixtures (goldenDeal, users, products)
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css             # CSS custom properties
│   └── main.tsx                   # MSW init and React DOM render
└── tests/
    ├── setup.ts
    ├── unit/                      # Format, RBAC, RiskBadge, StatusChip, Whitelist
    └── e2e/                       # Playwright Golden Lifecycle test
```

---

## 3. Dual App Shells & Security Isolation

### 3.1 Internal Sales Operations Shell (`/`)
- Guarded by `<RequireAuth />` and `<RequireRole roles={[...]} />`.
- Retains authentication state in `sessionStorage` under key `dealflow_auth_token`.
- Employs dark aesthetic (`#0B0F14` background, `#12161C` card surface, `#1E242D` elevated).
- Exposes full governance controls: Deal Guardian risk scoring, line-item margin breakdowns, approval decisions, fulfillment splits, and financial projections.

### 3.2 Zero-Trust Customer Portal Shell (`/portal/*`)
- Guarded by `<RequirePortalAuth />`.
- Uses an independent `sessionStorage` key: `dealflow_portal_token`.
- Enforces strict zero-leakage security:
  ```ts
  const FORBIDDEN_KEY_PATTERN = /(cost|margin|risk|ceiling|overage|approval|approver)/i;
  ```
  Any JSON payload crossing the portal boundary is filtered recursively to purge sensitive internal fields before rendering.
- Allows external buyers to view product descriptions, unit prices, approved discounts, deliverable quantities, submit counter-proposals, and sign deal confirmations.

---

## 4. Role-to-Screen Access Matrix

| Feature Screen | Route | SALES_REP | SALES_MANAGER | FINANCE | ADMIN | CUSTOMER |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Sales Rep Workspace** | `/` or `/dashboard` | `RW` | `RO` | `RO` | `RW` | `--` |
| **Control Tower** | `/control-tower` | `--` | `RW` | `RO` | `RW` | `--` |
| **Operations Dashboard** | `/operations` | `--` | `RO` | `RW` | `RW` | `--` |
| **Quotations List / Kanban** | `/quotations` | `RW` | `RW` | `RO` | `RW` | `--` |
| **Quotation Workspace** | `/quotations/:id` | `RW` | `RW` | `RO` | `RW` | `--` |
| **Approval Queue & Detail** | `/approvals`, `/approvals/:id` | `RO` | `RW` | `RW` | `RW` | `--` |
| **Fulfillment & Split Routing** | `/fulfillment`, `/fulfillment/:id` | `RO` | `RW` | `RW` | `RW` | `--` |
| **Billing & Subscriptions** | `/billing/:id`, `/subscriptions`, `/invoices` | `RO` | `RO` | `RW` | `RW` | `--` |
| **Deal Health & Alerts** | `/health` | `RO` | `RW` | `RW` | `RW` | `--` |
| **Reports & BI** | `/reports` | `RO` | `RW` | `RW` | `RW` | `--` |
| **Product Catalog** | `/catalog` | `RO` | `RO` | `RO` | `RW` | `--` |
| **Policy & Config** | `/config` | `--` | `--` | `--` | `RW` | `--` |
| **Customer Portal** | `/portal/*` | `--` | `--` | `--` | `--` | `RW` |

---

## 5. State Management & Data Fetching

1. **Server Cache (React Query)**:
   - Configured with `staleTime: 30000`, `gcTime: 300000`, and `refetchOnWindowFocus: false`.
   - Clear query key hierarchy in `@/api/queryKeys` ensuring that updating a deal line invalidates the quotation workspace, guardian risk scores, and approval state simultaneously.
2. **Client Session Stores (Zustand)**:
   - `authStore.ts`: Tracks internal user session, permissions, active company, and Odoo sync status.
   - `portalAuthStore.ts`: Tracks external customer contact details and magic token validity.
3. **Mock Service Worker (MSW v2)**:
   - Intercepts all REST API requests when running in mock mode.
   - Supports mutation side-effects: adding lines triggers real-time discount recalculation; submitting counters resets approvals to `INVALIDATED`; confirming orders creates split fulfillment shipments.

---

## 6. The Golden Demo Journey

DealFlow360 implements the complete 10-step Golden Demo Path:
1. **Rep View**: Rep navigates to `D-1024` for Acme Corp.
2. **Deal Guardian Evaluation**: Guardian calculates risk score of `56.0` (HIGH) due to a 20% discount on Laptop Pro, flagging `PENDING_MANAGER`.
3. **Next Best Action**: Guardian recommends adding `Universal Docking Station` (+8% margin bonus). Rep applies recommendation.
4. **Approval Request**: Quotation submitted to Sales Manager queue.
5. **Manager Decision**: Sales Manager reviews blended risk, margin delta, and clicks **Approve Deal**, unlocking quotation state in Odoo.
6. **Customer Portal Engagement**: Acme Buyer logs in via magic link (`/portal/verify?token=magic_token_acme_buyer`).
7. **Counter-Proposal**: Acme requests an enterprise 22% discount.
8. **Guardian Invalidation**: Deal Guardian invalidates the previous approval (`APPROVAL INVALIDATED`), recalculating risk score to `72.0` (ESCALATE, requiring both Manager + Finance).
9. **Final Acceptance**: Counter-offer approved and customer signs confirmation. Deal moves to `CONFIRMED`.
10. **Split Routing & Hybrid Billing**:
    - **Fulfillment**: 8 units dispatched from Main Warehouse; 2 units routed from East Depot.
    - **Billing**: One-time line invoiced immediately; recurring SaaS/maintenance lines scheduled through Odoo Subscriptions.
