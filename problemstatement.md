# DealFlow360 — Complete Project Documentation
### An Intelligent, Self-Governing Sales Operations Platform

**Document Type:** Software Requirements & Functional Specification
**Source:** Hackathon Problem Statement (SIH-style)
**Prepared for:** Team reference during build & demo prep

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Motivation](#2-problem-statement--motivation)
3. [Goals & Scope](#3-goals--scope)
4. [User Roles & Permission Matrix](#4-user-roles--permission-matrix)
5. [System Architecture Overview](#5-system-architecture-overview)
6. [Core Data Model](#6-core-data-model)
7. [Module A — Sales Backend (Configuration)](#7-module-a--sales-backend-configuration)
8. [Module B — Sales Frontend (Rep Workspace)](#8-module-b--sales-frontend-rep-workspace)
9. [Blended Discount Risk Score — Full Logic](#9-blended-discount-risk-score--full-logic)
10. [End-to-End Workflow](#10-end-to-end-workflow)
11. [State Machines](#11-state-machines)
12. [Business Rule Engine — Detailed Logic](#12-business-rule-engine--detailed-logic)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Technical Guidelines & Constraints](#14-technical-guidelines--constraints)
15. [Deliverables Checklist](#15-deliverables-checklist)
16. [Quick Test Flow (Acceptance Script)](#16-quick-test-flow-acceptance-script)
17. [Suggested Tech Stack Options](#17-suggested-tech-stack-options)
18. [Risks, Edge Cases & Open Questions](#18-risks-edge-cases--open-questions)
19. [Future Roadmap (Post-Hackathon)](#19-future-roadmap-post-hackathon)
20. [Appendix: Reference Links](#20-appendix-reference-links)

---

## 1. Executive Summary

DealFlow360 is a B2B **Sales Operations platform** that extends beyond a simple "quote → invoice" tool into a **self-governing deal engine**. It enforces pricing discipline through automated, tiered approval routing; reacts to real-time inventory across multiple warehouses; reconciles one-time and recurring billing on a single order; and gives both sales reps and customers a living, negotiable quotation rather than a static PDF.

The platform has two structural halves:

| Half | Purpose |
|---|---|
| **Sales Backend (Configuration Area)** | Where Admins/Managers define products, pricing, discount ceilings, approval chains, warehouses, and subscription plans |
| **Sales Frontend (Rep Workspace)** | Where reps build quotations, receive upsell suggestions, manage approvals, fulfillment, billing, and where customers negotiate via a portal |

---

## 2. Problem Statement & Motivation

Most sales tools handle only the basics — create a quote, confirm an order, invoice it. Real B2B sales teams operate in messier conditions:

- Multi-level discount approvals
- Partial stock spread across warehouses
- Bundled subscriptions mixed with one-time hardware
- Customers who want to negotiate inside a portal instead of over email
- Managers who only discover a deal is stuck **after** it has already lost momentum

DealFlow360 is designed to solve all of the above in one coherent data model and workflow.

---

## 3. Goals & Scope

### Main Goal
Build a complete sales flow including backend configuration and a frontend quotation-to-cash experience.

### Key Outcomes (Definition of Done)

| # | Outcome |
|---|---|
| 1 | Rep can log in, build a quotation, and have it auto-route for correct approval based on discount % and customer tier |
| 2 | Rep receives live upsell/cross-sell suggestions with real-time margin impact while building the quote |
| 3 | Order can be auto-split across warehouses based on stock availability, with manual override |
| 4 | A single order can mix one-time products and recurring subscription lines with correct proration and billing schedules |
| 5 | Dashboard shows deal health, stalled quotes, and discount anomalies in real time |
| 6 | Customer can view and negotiate the quotation directly from a customer-facing portal, no email back-and-forth |

### Out of Scope / Bonus
- Multi-currency or multi-company support is a **bonus**, not a requirement.

---

## 4. User Roles & Permission Matrix

| Role | Core Responsibilities | Can Approve? | Portal Access |
|---|---|---|---|
| **Sales Rep** | Builds quotations, applies discounts, adds upsell items, tracks approval/fulfillment status, responds to customer negotiation requests | No | No (internal workspace only) |
| **Sales Manager / Approver** | Reviews/approves/rejects quotations exceeding discount thresholds, configures discount tiers & approval chains, monitors deal health dashboard | Level 1 | No |
| **Finance / Operations User** | Second-level approvals for high-risk discounts, manages warehouse fulfillment splits & backorder decisions, reconciles recurring billing & credit notes | Level 2 | No |
| **Customer (Portal User)** | Views quotation online, requests changes, asks line-level questions, counters a discount, confirms final terms with one click | No (triggers re-approval indirectly) | Yes (restricted, separate view) |
| **Admin** | Manages backend setup (products, price lists, discount tiers, warehouses, subscription plans), views platform-wide analytics/reporting | No | No |

**Design rule:** The customer-facing negotiation screen must be a **real, separate, restricted view** — not an internal screen with a different label and loosened permissions.

---

## 5. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DealFlow360 Platform                     │
├───────────────────────────────┬───────────────────────────────┤
│      SALES BACKEND (Admin)     │     SALES FRONTEND (Rep)        │
│  - Auth (internal + portal)    │  - Quotation List / Pipeline    │
│  - Product & Price List Mgmt   │  - Quotation Builder            │
│  - Discount Tier & Approval    │  - Discount Approval Screen     │
│    Chain Setup                 │  - Upsell/Cross-sell Panel      │
│  - Warehouse & Fulfillment     │  - Fulfillment/Warehouse Split  │
│    Setup                       │  - Subscription & Billing       │
│  - Subscription Plan Setup     │  - Deal Health Dashboard        │
│  - Upsell Rule Setup           │                                  │
│  - Reporting Config            │                                  │
└───────────────────────────────┴───────────────────────────────┘
                                │
                                ▼
                 ┌──────────────────────────────┐
                 │  Customer Portal (Restricted) │
                 │  - View quotation             │
                 │  - Negotiate / Counter         │
                 │  - Confirm                     │
                 └──────────────────────────────┘
                                │
                                ▼
              ┌───────────────────────────────────┐
              │  Core Rule Engine (App Logic Layer) │
              │  - Approval Routing                 │
              │  - Blended Risk Scoring             │
              │  - Warehouse Split Optimizer         │
              │  - Proration & Billing Engine         │
              │  - Anomaly Detection                  │
              └───────────────────────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │   Database    │
                        │ (Relational/  │
                        │  Document)    │
                        └───────────────┘
```

**Key architectural principle:** All core business rules (approval routing, discount governance, warehouse splitting, billing proration) must live in **application logic**, not be hardcoded or faked for the demo.

---

## 6. Core Data Model

### 6.1 Entity List (inferred from requirements)

| Entity | Key Fields | Notes |
|---|---|---|
| **User** | id, name, email, role (Rep/Manager/Finance/Admin), password_hash | Internal users |
| **Customer** | id, name, tier (Bronze/Silver/Gold), email, portal_login_type (magic-link/password) | Drives price list + discount ceiling |
| **Product** | id, name, category, base_price, unit, tax, description, margin_baseline | Category drives discount ceiling |
| **ProductVariant** | id, product_id, attribute (Size/Pack), value, extra_price | |
| **PriceList** | id, customer_tier, currency, product_id, price_override | |
| **DiscountTier** | id, tier_name, max_discount_pct | e.g., Bronze 5%, Silver 10%, Gold 15% |
| **CategoryDiscountCeiling** | id, category_id, max_discount_pct | Category-specific override |
| **ApprovalChainRule** | id, discount_range_min, discount_range_max, required_levels (Manager / Manager+Finance) | |
| **Warehouse** | id, name, location, stock_levels, replenishment_rules, shipping_cost_weight | |
| **SubscriptionPlan** | id, name, billing_cycle (monthly/quarterly/yearly), proration_rules, cancellation_rules | |
| **UpsellRule** | id, base_product_id, suggested_product_id, min_margin_threshold, is_promoted | |
| **Quotation** | id, customer_id, rep_id, status, created_at, blended_risk_score | |
| **QuotationLine** | id, quotation_id, product_id, quantity, discount_pct, line_type (one-time/recurring) | |
| **ApprovalLog** | id, quotation_id, approver_id, level, action (approve/reject/return), reason, timestamp | Full audit trail |
| **WarehouseSplit** | id, quotation_id, warehouse_id, quantity_fulfilled, shipment_cost | |
| **BillingSchedule** | id, quotation_line_id, cycle_date, amount, status | |
| **CreditNote** | id, subscription_id, amount, reason, created_at | |
| **NegotiationThread** | id, quotation_id, comments[], counter_discount_pct, status | Customer portal interactions |
| **DealHealthFlag** | id, quotation_id, flag_type (stalled/anomaly/slippage), raised_at, resolved_at | |

### 6.2 Key Relationships
- `Customer (1) → (N) Quotation`
- `Quotation (1) → (N) QuotationLine`
- `Quotation (1) → (N) ApprovalLog`
- `Quotation (1) → (N) WarehouseSplit`
- `QuotationLine (1) → (N) BillingSchedule` (only for recurring lines)
- `Product (N) ↔ (N) Product` via `UpsellRule` (self-referencing pairing table)

---

## 7. Module A — Sales Backend (Configuration)

### A1. Authentication (Login / Signup)
- Internal users sign up/log in with standard credentials.
- Customers access their quotations via portal login (magic link OR email+password).
- Post-login, internal users land on backend configuration + can open a sales workspace.

### A2. Product & Price List Management
- **General Info:** Name, Category, Price, Unit, Tax, Description
- **Variants:** Attribute (Size/Pack), Values, Extra prices
- **Price Lists:** Customer-tier-based pricing, currency-specific rules

### A3. Discount Tier & Approval Chain Setup
- Discount ceilings per customer tier (Bronze 5%, Silver 10%, Gold 15% — example values)
- Category-specific discount ceilings (some categories allow more discretion than others)
- Approval chain configuration: which discount range needs Manager only vs. Manager + Finance

**Critical rule:** When a quote mixes categories with different ceilings, the system computes a **blended risk score** and routes to the highest required level (see Section 9).

All approvals, rejections, and edits must be logged with **user, timestamp, and reason** — full audit trail.

### A4. Warehouse & Fulfillment Setup
- Create/manage warehouses (e.g., "Main Warehouse", "East Depot")
- Configure stock levels and replenishment rules per warehouse
- Define shipping cost weighting used by the auto-split logic to **minimize number of shipments**

### A5. Subscription / Recurring Plan Setup
- Define recurring plans: monthly / quarterly / yearly, attachable to specific products/services
- Configure proration rules for mid-cycle quantity or plan changes
- Configure cancellation and partial refund rules

### A6. Upsell / Cross-Sell Rule Setup (Optional)
- Define product pairings based on historical co-purchase data
- Mark products as "currently promoted" to rank higher in suggestions
- Set minimum margin thresholds — only healthy-margin suggestions surface

### A7. Reporting & Dashboard Configuration
- Dashboard + reporting menu for sales performance
- Export options: PDF / XLS
- **Filters:** Period (date range/custom), Sales Team/Rep, Approval Status (pending/approved/rejected), Product/Category

---

## 8. Module B — Sales Frontend (Rep Workspace)

### B1. Sales Workspace — Top Menu
- **Quotations** → list of active/draft quotations
- **Pipeline** → Kanban-style deal pipeline view
- **Actions:** Reload Data (refresh pricing/stock/approval data), Go to Back-end, Close Workspace

### B2. Quotation List / Pipeline View
- Quotations shown as selectable cards: customer, amount, stage
- Example: "Acme Corp, Draft" / "Beta Industries, Pending Approval"
- Selecting a card opens the Quotation Builder

### B3. Quotation Builder Screen
- Pick products across categories (Hardware, Services, Subscriptions)
- Adjust quantities (+/-)
- Apply line-level or order-level discounts
- View order lines with price totals + **live margin indicator**
- Confirm → move to approval, or straight to fulfillment if no approval required

### B4. Discount Approval Screen
- Displays blended risk score
- Approval steps list: Sales Manager, and Finance (shown only when required)
- Reviewer actions: Approve / Reject / Return for revision
- Confirmation screen includes a full audit trail entry

### B5. Upsell and Cross-Sell Panel
Shown alongside the cart while building a quotation:
- Ranked suggestion list (co-purchase history + active promotions)
- Displays: Suggested product, Margin delta if added, Promotion tag
- Buttons: **Add to Quote**, **Dismiss**
- Margin indicator updates immediately after adding a suggestion

### B6. Fulfillment and Warehouse Split Screen
- Recommended warehouse split shown based on live stock
- Displays: Warehouse name, Quantity fulfilled, Estimated shipment count and cost
- Buttons: **Accept Suggested Split**, **Manual Override**
- Auto-prompt: "Consolidate Remaining Backorder" appears if stock arrives mid-fulfillment

### B7. Subscription and Billing Screen
- One-time lines and recurring lines shown **separately** within the same order
- Displays upcoming billing schedule for recurring lines
- Handles mid-cycle proration when quantity changes
- Cancel/modify subscription controls → auto-trigger partial refund or credit note when applicable

### B8. Customer Portal Negotiation Screen (Separate, Restricted)
- Shows quotation details + status (Sent / Under Negotiation / Confirmed)
- Line-level comment and change-request tool
- Counter discount proposal field
- Buttons: **Submit Request**, **Confirm Quotation**
- **After confirmation:** if final terms exceed approval thresholds → auto re-enters approval flow (B4); otherwise → moves directly to fulfillment

### B9. Deal Health and Anomaly Dashboard
- Stalled deals (inactive beyond configured days)
- Discount anomaly alerts (discount well above rep's historical average)
- Delivery promise slippage indicators
- Clicking an alert opens the related quotation directly
- Automated nudge/escalation action triggerable from an alert

---

## 9. Blended Discount Risk Score — Full Logic

This score decides **whether a quotation needs manager approval**, and if so, **whether it also needs finance approval**.

### Core Principle
> Different products are allowed different discount limits. The system checks **every line against its own limit**, not just one overall limit for the whole order.

### Worked Example

A **Gold customer** is normally allowed up to 15% discount. But within the same order:

| Category | Allowed Ceiling |
|---|---|
| Hardware | 15% (healthy margins) |
| Services | 10% (thin margins) |

Quote built by rep:

| Line | Category | Discount Given | Allowed | Over Limit? |
|---|---|---|---|---|
| Laptop | Hardware | 12% | 15% | No — within limit |
| Setup Service | Service | 18% | 10% | **Yes — 8 points over** |

**Result:** Even though the customer is Gold and 15% "sounds fine" overall, the Service line broke its own stricter category limit → the **whole quotation is flagged for approval** because of that one line.

### Why "Blended"?
Sometimes no single line is badly over its limit, but *many* lines are each a little over (e.g., +2, +3, +2 points). None look alarming alone, but summed across the order, the rep has quietly given away significant margin. The blended score evaluates the **total pattern across the order**, not just the single worst line — so small, distributed violations can't slip through.

### Suggested Calculation Approach (implementation guidance)
```
For each line:
    line_excess = max(0, discount_given - category_ceiling)

blended_score = sum(line_excess across all lines) 
                 weighted by line value / total order value

IF blended_score == 0:
    → No approval required
ELIF blended_score <= manager_threshold:
    → Route to Sales Manager only
ELSE:
    → Route to Sales Manager, then Finance
```

### Why This Matters
- Managers aren't stuck manually reviewing every single quotation.
- Prevents a rep from keeping every line "technically" within limits while still discounting the order more than the company intends overall.

---

## 10. End-to-End Workflow

```
1. Rep signs up (first time) or logs in
2. Admin configures backend (products, price lists, discount tiers,
   approval chains, warehouses, subscription plans)
3. Rep opens workspace → creates new quotation for a customer
4. Rep adds products, applies discounts, reviews upsell suggestions
5. IF discount/blended risk score exceeds threshold:
       → Auto-route for approval (Manager → Finance if required)
6. ELSE / once approved:
       → System suggests warehouse fulfillment split
7. Order may include recurring subscription lines
       → Generates billing schedule alongside one-time invoice
8. Customer receives quotation link → negotiates via portal
9. IF terms change beyond thresholds during negotiation:
       → Quote re-enters approval flow automatically
10. Once confirmed → order proceeds to fulfillment and billing
11. Manager monitors Deal Health dashboard throughout the cycle
12. Reports reviewed using filters (Period / Team / Status / Product)
```

---

## 11. State Machines

### 11.1 Quotation Status Flow
```
DRAFT 
  → PENDING_APPROVAL (if discount/risk exceeds threshold)
      → MANAGER_REVIEW → [APPROVED | REJECTED | RETURNED_FOR_REVISION]
      → (if required) FINANCE_REVIEW → [APPROVED | REJECTED | RETURNED_FOR_REVISION]
  → SENT_TO_CUSTOMER
      → UNDER_NEGOTIATION → (loops back to PENDING_APPROVAL if thresholds re-triggered)
      → CONFIRMED
  → FULFILLMENT_IN_PROGRESS
      → PARTIALLY_FULFILLED (backorder) → FULFILLED
  → BILLED / INVOICED
  → CLOSED
```

### 11.2 Subscription Line Status Flow
```
ACTIVE → [MODIFIED (proration triggered)] → ACTIVE
ACTIVE → CANCELLED → (partial refund / credit note issued)
```

### 11.3 Warehouse Fulfillment Status Flow
```
STOCK_CHECK → SPLIT_RECOMMENDED → [ACCEPTED | MANUALLY_OVERRIDDEN]
  → PARTIAL_BACKORDER → CONSOLIDATE_PROMPT → FULFILLED
```

---

## 12. Business Rule Engine — Detailed Logic

| Rule Domain | Trigger | Logic | Output |
|---|---|---|---|
| **Discount Governance** | Rep applies line/order discount | Compare against tier + category ceiling → compute blended score | Route to none / Manager / Manager+Finance |
| **Warehouse Split** | Order confirmed or approved | Check stock per warehouse, minimize shipment count via shipping-cost weighting | Suggested split (allow manual override) |
| **Backorder Handling** | Insufficient stock at split time | Flag remaining qty as backorder | "Consolidate Remaining Backorder" prompt when stock arrives |
| **Hybrid Billing** | Order has mixed one-time + recurring lines | Separate invoice generation for one-time vs. billing schedule for recurring | Two reconciled billing tracks under one order |
| **Proration** | Mid-cycle quantity/plan change on subscription | Calculate prorated amount based on remaining cycle days | Adjusted invoice/credit |
| **Anomaly Detection** | New discount applied | Compare against rep's historical average discount | Flag anomaly if significantly above average |
| **Stalled Deal Detection** | Quotation inactivity | Compare last-updated timestamp against configured threshold days | Flag as stalled on dashboard |
| **Upsell Ranking** | Rep building quote | Rank by co-purchase frequency + promotion flag, filter by min margin threshold | Ranked suggestion list with margin delta |
| **Re-approval on Negotiation** | Customer counters discount in portal | Recompute blended risk score with new terms | Re-enter approval flow if threshold exceeded |

---

## 13. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Auditability** | Every approval, rejection, and edit must log user, timestamp, and reason |
| **Real-time responsiveness** | Margin indicator and upsell panel must update immediately on cart changes |
| **Data integrity** | Warehouse stock and billing schedules must stay consistent across concurrent updates |
| **Security / Access Control** | Customer portal must be a genuinely restricted, separate view — not internal access with hidden fields |
| **Extensibility** | Tech-agnostic — any backend language, frontend framework, relational or document database |
| **Auditable Rule Engine** | Core rules must be implemented in application logic, not hardcoded/faked for demo |

---

## 14. Technical Guidelines & Constraints

- Teams may use **any tech stack** — any backend language, any frontend framework, any relational or document database.
- Core business rules (approval routing, discount governance, warehouse splitting, billing proration) **must be implemented in application logic** — not hardcoded or faked for the demo.
- The customer-facing negotiation screen must be a **real, separate, restricted view**, not a relabeled internal screen.
- Multi-currency or multi-company support is a **bonus**, not a requirement.

---

## 15. Deliverables Checklist

- [ ] A working application (backend + frontend) with sample seed data
- [ ] A five-minute live demo covering **at least two full flows** end-to-end, from quotation to fulfillment or billing
- [ ] A **one-page architecture diagram** showing the data model and how major modules connect
- [ ] A short note on **what the team would build next** with more time

---

## 16. Quick Test Flow (Acceptance Script)

Use this to validate that the core logic works — not just the screens. Each step must produce a visible, correct result before the next.

1. Sign up/log in; set up basic backend data: a discount tier, a warehouse, a subscription plan
2. Create a quotation, add a product line with a discount **higher than normally allowed**
3. Confirm the quotation **automatically** asks for manager approval (no manual trigger by rep)
4. While building the quote, accept one upsell suggestion → confirm order total and margin update immediately
5. Get the quotation approved → confirm stock is pulled from the correct warehouse, splitting across two warehouses if needed
6. Check that a one-time product and a recurring subscription on the same order are billed **correctly and separately**
7. Open the customer portal view, request a bigger discount as the customer → confirm the quote **automatically** goes back for approval
8. Confirm the order, record a payment, check that invoice status updates correctly

**Pass criteria:** All 8 steps work smoothly and match expected results → core flow is solid.

---

## 17. Suggested Tech Stack Options

*(Not prescribed by the problem statement — for team decision-making only)*

| Layer | Option Set |
|---|---|
| Backend | Node.js/Express, Python/FastAPI or Django, Java/Spring Boot |
| Frontend | React, Vue, or Next.js |
| Database | PostgreSQL (relational, good for approval chains/audit logs) or MongoDB (document, faster iteration) |
| Real-time updates | WebSockets / Socket.io for live margin & dashboard updates |
| Auth | JWT for internal users; magic-link email service for customer portal |
| Reporting export | PDF via server-side rendering; XLS via a spreadsheet library |

---

## 18. Risks, Edge Cases & Open Questions

| Area | Risk / Edge Case |
|---|---|
| Blended risk score | How are weights determined when line values vary hugely? Needs a clear, documented formula for the demo. |
| Warehouse split | What happens if **no** warehouse combination can fulfill the order at all (total stock shortfall)? |
| Subscription proration | Plan changes mid-cycle with different billing frequencies (e.g., monthly → yearly) need explicit proration rules. |
| Customer negotiation | Multiple simultaneous negotiation threads on the same quotation — conflict resolution logic needed. |
| Approval loop | Could a customer repeatedly counter-offer to create an infinite approval loop? Needs a cap or cooldown. |
| Currency/multi-company | Explicitly bonus scope — confirm team will not over-invest here given time constraints. |

---

## 19. Future Roadmap (Post-Hackathon)

- Multi-currency and multi-company support
- AI-driven margin optimization for upsell ranking
- Predictive deal health scoring (ML-based stall prediction, not just rule-based)
- Native mobile app for reps and customers
- Integration with external ERPs/accounting systems for invoice sync
- Advanced analytics: cohort-based discount behavior across reps/teams

---

## 20. Appendix: Reference Links

- **Mockup (Excalidraw):** https://app.excalidraw.com/l/65VNwvy7c4X/7Fb5SR3WKu2

---

*Document compiled from the original DealFlow360 hackathon problem statement, structured for team reference during design, build, and demo preparation.*