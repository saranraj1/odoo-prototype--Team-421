# DealFlow360 — 4-Person Task Ownership

## Golden Rule

**Each person only works inside their assigned ownership area.**

Do NOT modify another person's files, schema, APIs, UI components, Odoo models, or business logic unless explicitly coordinated and approved.

If a dependency is missing, communicate it to the owner instead of implementing it yourself.

---

# PERSON 1 — DB ARCHITECT

## Owns ONLY

- DealFlow PostgreSQL database schema
- ERD
- Tables
- PK/FK relationships
- Constraints
- Indexes
- Migrations
- Seed data for DealFlow DB
- Database naming conventions
- Odoo ID reference strategy
- Data integrity
- Historical/snapshot design
- Repository/data-access layer
- Data contracts with other services

## Tables owned

- `deal`
- `discount_policy`
- `risk_assessment`
- `risk_factor`
- `approval_request`
- `approval_action`
- `negotiation_request`
- `negotiation_change`
- `fulfillment_plan`
- `fulfillment_plan_line`
- `recommendation`
- `deal_health_snapshot`
- `audit_event`

## MUST NOT TOUCH

- Governance/risk algorithms
- Approval business logic
- Odoo models
- Odoo controllers
- Frontend UI
- Frontend styling
- Odoo configuration
- Portal implementation

## Main deliverables

1. Final ERD
2. Physical schema
3. Migration scripts
4. Constraints/indexes
5. Repository interfaces
6. DealFlow DB seed data
7. Data dictionary

---

# PERSON 2 — ODOO INTEGRATION ENGINEER

## Owns ONLY

- Odoo module/addon
- Odoo ORM
- Odoo models
- Odoo API integration
- Odoo ↔ DealFlow communication
- Odoo Sales integration
- Odoo Inventory integration
- Odoo Subscription integration
- Odoo Accounting integration
- Odoo Portal integration
- Odoo users/groups/ACLs/record rules
- Odoo-side transaction execution
- Odoo seed data
- Odoo event hooks/callbacks

## Odoo models owned

- `res.partner`
- `product.template`
- `product.product`
- `product.category`
- `sale.order`
- `sale.order.line`
- `stock.warehouse`
- `stock.quant`
- `stock.picking`
- invoice/accounting models
- subscription-related models
- Odoo users/security

## MUST NOT TOUCH

- DealFlow PostgreSQL schema
- Risk formulas
- Approval decision logic
- Recommendation algorithms
- Deal Health algorithms
- Frontend UI
- Frontend business logic

## Main deliverables

1. Odoo module
2. Odoo integration service
3. Odoo API/adapters
4. Odoo security
5. Sales integration
6. Inventory integration
7. Subscription/billing integration
8. Portal integration
9. Odoo seed/demo data

## Critical responsibility

Make Odoo the **transactional source of truth**.

Do NOT create duplicate customers, products, orders, stock, invoices, payments, or subscriptions in DealFlow DB.

---

# PERSON 3 — DEAL GOVERNANCE ENGINEER

## OWNERSHIP: THIS IS YOUR CORE AREA

You own the **Deal Governance Layer / Deal Guardian**.

## Owns ONLY

- Deal Context assembly logic
- Policy Engine
- Discount Governance
- Risk Engine
- Risk calculation
- Risk-factor generation
- Approval decision logic
- Approval routing
- Approval state machine
- Approval invalidation
- Reapproval logic
- Material-change detection
- Negotiation evaluation logic
- Recommendation scoring logic
- Fulfillment planning algorithm
- Deal Health calculation
- Next Best Action
- Governance event orchestration
- Idempotency logic
- Governance API/service endpoints

## Core modules

```text
policy/
risk/
approval/
negotiation/
recommendation/
fulfillment/
health/
orchestration/
```

## Core functions

- `get_deal_context()`
- `resolve_policy()`
- `evaluate_deal()`
- `calculate_risk()`
- `explain_risk()`
- `determine_approval()`
- `create_approval()`
- `approve_deal()`
- `reject_deal()`
- `return_deal()`
- `is_material_change()`
- `invalidate_approval()`
- `evaluate_negotiation()`
- `generate_recommendations()`
- `plan_fulfillment()`
- `calculate_deal_health()`
- `determine_next_best_action()`
- `handle_governance_event()`

## Business rules owned

### Discount

- Customer-tier limits
- Category limits
- Effective policy resolution
- Discount excess

### Risk

- Blended risk calculation
- Margin risk
- Discount risk
- Inventory risk
- Approval-delay risk
- Other configured risk factors

### Approval

- Auto approval
- Manager approval
- Finance approval
- Multi-step approval
- Rejection
- Return for revision
- Approval invalidation
- Reapproval

### Recommendation

- Co-purchase score
- Promotion score
- Margin score
- Recommendation ranking

### Fulfillment

- Warehouse ranking
- Allocation algorithm
- Backorder calculation
- Shipment/cost estimation

### Deal Health

- Stalled deal detection
- Discount anomaly
- Delivery risk
- Approval delay
- Overall health

### Next Best Action

Examples:

- Finance approval required
- Manager approval required
- Reduce discount
- Add recommended product
- Resolve stock issue
- Follow up with customer
- Reapproval required

## MUST NOT TOUCH

- Database schema definitions
- Odoo model implementation
- Odoo ACLs
- Odoo Portal UI
- Frontend component implementation
- Frontend styling
- Odoo seed-data structure

## Critical rules

1. Business logic must NOT live in frontend.
2. Do NOT directly query Odoo models everywhere.
3. Use the Odoo integration interface provided by Person 2.
4. Use the repository/data interfaces provided by Person 1.
5. Do NOT create competing tables or schemas.
6. Core decisions must be deterministic and explainable.
7. AI must never override business policy.

---

# PERSON 4 — FRONTEND / UX ENGINEER

## Owns ONLY

- Frontend application
- Routing
- Navigation
- Role-based UI
- Sales Rep experience
- Manager experience
- Finance/Ops experience
- Customer Portal UI
- Quotation Builder
- Deal Guardian UI
- Approval Center UI
- Control Tower
- Fulfillment UI
- Billing UI
- Reports UI
- Loading/error/empty states
- API client
- UI state management
- Visual design

## Main screens owned

### Sales Rep

- Home / My Deals
- Quotations
- Pipeline
- Quotation Builder
- Deal Detail
- Approvals
- Fulfillment
- Reports

### Manager

- Control Tower
- Approval Center
- At-Risk Deals
- Deal Health
- Fulfillment
- Reports

### Finance/Ops

- Approval Queue
- Fulfillment
- Billing
- Exceptions
- Deal Detail

### Customer

- My Quotes
- Quote View
- Negotiation
- Billing
- Confirmation
- Activity

## Main reusable components

- Deal Guardian
- Risk Card
- Risk Breakdown
- Approval Timeline
- Recommendation Panel
- Margin Summary
- Fulfillment Split
- Deal Timeline
- Health Indicator
- Action Queue
- KPI Cards
- Filters

## MUST NOT TOUCH

- Database schema
- Database migrations
- Risk formulas
- Approval algorithms
- Recommendation algorithms
- Fulfillment algorithms
- Deal Health algorithms
- Odoo ORM
- Odoo business logic

## Critical rule

Frontend displays and submits decisions.

Frontend does NOT make business decisions.

Bad:

```text
if discount > 15:
    show finance approval
```

Good:

```text
Frontend
→ DealFlow API
→ Decision Engine
→ Decision returned
→ Frontend displays result
```

---

# SHARED INTERFACE RULES

## Person 1 → Everyone

Provides:

- schema
- repository interfaces
- data contracts
- canonical names

Everyone follows these.

---

## Person 2 → Person 3

Provides:

- customer context
- product context
- sales-order context
- stock context
- subscription state
- invoice/payment state
- Odoo transaction commands

Person 3 does NOT directly implement Odoo access.

---

## Person 3 → Person 4

Provides:

- Deal API
- risk result
- approval result
- recommendations
- fulfillment result
- health result
- next-best-action

Person 4 does NOT implement governance rules.

---

## Person 2 ↔ Person 4

For:

- portal authentication
- Odoo-facing UI integration
- Odoo user/security behavior

Business decisions still belong to Person 3.

---

# FILE / CODE OWNERSHIP

## Person 1

```text
db/
migrations/
repositories/
schema/
docs/erd/
```

## Person 2

```text
odoo/
odoo_addons/
integration/
odoo_adapters/
security/
```

## Person 3

```text
governance/
policy/
risk/
approval/
negotiation/
recommendation/
fulfillment/
health/
orchestration/
api/governance/
```

## Person 4

```text
frontend/
components/
pages/
routes/
styles/
api-client/
```

---

# CHANGE CONTROL

Before touching another person's area:

1. Ask the owner.
2. Explain the dependency.
3. Agree on the interface/change.
4. Let the owner implement the change whenever practical.

Do NOT silently modify another person's work.

---

# GOLDEN DEPENDENCY FLOW

```text
PERSON 1
DB / DATA
    ↓
PERSON 2
ODOO INTEGRATION
    ↓
PERSON 3
DEAL GOVERNANCE
    ↓
PERSON 4
FRONTEND / EXPERIENCE
```

Frontend may use mocked contracts early so it does not block.

---

# FINAL RESPONSIBILITY SUMMARY

| Person | Owns | Does NOT Own |
|---|---|---|
| 1. DB Architect | Schema, migrations, data integrity | Business logic, Odoo, UI |
| 2. Odoo Engineer | Odoo, ORM, integrations, security | Risk/approval logic, UI |
| 3. Governance Engineer | Policy, risk, approval, recommendations, orchestration | DB schema, Odoo models, UI |
| 4. Frontend Engineer | UI, UX, portal, dashboards, API client | Business rules, DB, Odoo ORM |

---

# NON-NEGOTIABLE ARCHITECTURE

```text
                 ODOO
          Transactional Truth
                  │
                  │
                  ▼
          ODOO INTEGRATION
                  │
                  ▼
          DEALFLOW GOVERNANCE
                  │
      ┌───────────┼───────────┐
      │           │           │
    Policy      Risk       Decisions
      │           │           │
      └───────────┼───────────┘
                  │
                  ▼
             FRONTEND
                  │
                  ▼
               USERS
```

## Product principle

> **Odoo owns transactions. DealFlow owns decisions. Frontend displays decisions. DB preserves state.**

## Most important rule for AI agents

> **An agent must only modify files and code inside its assigned ownership boundary. If a task requires another domain, stop and report the dependency instead of implementing it.**
