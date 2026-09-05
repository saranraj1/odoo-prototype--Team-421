# DEBUG REPORT: Frontend Buttons Investigation & Resolution

- **Date**: 2026-09-05
- **Symptom**: User observed that "many buttons arent working" across the frontend. Multiple interactive buttons returned HTTP 404, rendered duplicate actions, or remained permanently disabled.
- **Root Cause**:
  1. **Missing Mock API Endpoints (`frontend/src/mocks/handlers.ts`)**: `USE_MOCKS` defaults to `true`. When interactive buttons fired mutations, MSW lacked mock route handlers for:
     - `POST /api/v1/deals` (New Quotation: "Create & Evaluate Quotation")
     - `POST /api/v1/deals/:id/evaluate` (Quotation Workspace: "Re-evaluate")
     - `PATCH /api/v1/deals/:id` (Quotation Workspace: virtual order discount)
     - `POST /api/v1/deals/:id/lines` & `DELETE /api/v1/deals/:id/lines/:lineId` (Lines Table: add/remove lines)
     - `POST /api/v1/deals/:id/recommendations/:rid/dismiss` (Recommendations: dismiss "X" button)
     - `POST /api/v1/deals/:id/fulfillment/accept`, `override`, `apply`, `consolidate` (Fulfillment Detail: all 4 action buttons)
     - `POST /api/v1/deals/:id/billing/invoices/:invId/payments` (Invoice Detail: "Record Payment" in modal)
     - `POST /api/v1/alerts/:id/actions`, `acknowledge`, `resolve` (Control Tower / Deal Health: "Nudge Rep" and "Escalate")
     - `GET /api/v1/reports/:type?format=pdf|xlsx` (Reports: "Export PDF" and "Export XLS" binary blob downloads)
     - `PUT /api/v1/admin/settings` (Config: "Save Configuration" button)
     - `POST /api/v1/portal/deals/:id/negotiations/:reqId/withdraw` (Portal: withdraw proposal)
     - `POST /api/v1/portal/deals/:id/comments` (Portal: add comment)
  2. **Negotiation Resolution Glitch (`handlers.ts`)**: Responding to customer counteroffers didn't prune the resolved request from `open_requests`, causing the counter-offer warning banners to persist indefinitely.
  3. **Duplicate Button Markup (`frontend/src/features/quotations/NewQuotationPage.tsx`)**: Two adjacent "Create & Evaluate Quotation" button blocks rendered stacked on top of each other.
  4. **State Machine & Rendering Bug (`frontend/src/features/quotations/QuotationWorkspacePage.tsx`)**: The top action button strictly checked `deal.approval_state === 'NOT_EVALUATED'`, rendering a permanently disabled "Send to Customer" button whenever a deal was in `DRAFT`, `RETURNED`, or `INVALIDATED` status instead of "Submit for Approval". In addition, `onUpdateOrderDiscount` lacked React Query mutation wrapping.

- **Fix**:
  1. [handlers.ts](file:///c:/Hackathon/odoo/frontend/src/mocks/handlers.ts): Added complete suite of mock handlers for deal creation, re-evaluation, patching, lines mutation, recommendation dismissal, fulfillment split operations, billing payment registration, alert action handling, unified report data & binary blob exports, configuration persistence, and portal comments/withdrawals. Pruned resolved counteroffers upon accept/reject.
  2. [NewQuotationPage.tsx](file:///c:/Hackathon/odoo/frontend/src/features/quotations/NewQuotationPage.tsx): Cleaned up redundant button block.
  3. [QuotationWorkspacePage.tsx](file:///c:/Hackathon/odoo/frontend/src/features/quotations/QuotationWorkspacePage.tsx): Corrected status checks to show "Submit for Approval" for `NOT_EVALUATED`, `DRAFT`, `RETURNED`, and `INVALIDATED`; dynamic "Pending Approval" link during review stages; and wrapped `onUpdateOrderDiscount` in a mutation with immediate cache invalidation.

- **Evidence**:
  - `npm run build` in `frontend` passes cleanly (`tsc -b && vite build` built in 2.13s with zero errors).
  - Automated MSW test suite `npx tsx scripts/test-button-endpoints.mjs` executed 16/16 test assertions across all workflows with 100% pass rate.
  - Backend `pytest backend/tests` 55/55 passed.

- **Regression test**: [test-button-endpoints.mjs](file:///c:/Hackathon/odoo/frontend/scripts/test-button-endpoints.mjs)
- **Related**: Integration between Vite frontend, MSW mock worker, and FastAPI backend routes.
- **Status**: DONE
