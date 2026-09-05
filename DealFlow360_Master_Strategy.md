# DealFlow360 — Odoo Finale Master Specification

> **Project:** DealFlow360  
> **Hackathon:** Odoo Finale — 24-hour implementation  
> **Selected Problem:** Intelligent, Self-Governing Sales Operations Platform  
> **Team Size:** 4  
> **Core Strategy:** Odoo as the transactional ERP/source of truth + DealFlow as the intelligence, governance and orchestration layer  
> **Primary Product Thesis:** A deal should continuously evaluate itself, detect commercial/operational risk, determine what governance is required, and guide the next action.

---

# 1. Executive Summary

DealFlow360 is a sales operations platform designed around a difficult real-world B2B sales problem: complex deals do not simply move from quote to invoice.

A deal may involve:

- customer-specific pricing;
- tier-specific discount limits;
- category-specific discount limits;
- multiple levels of approval;
- margin pressure;
- inventory distributed across warehouses;
- recurring subscriptions mixed with one-time sales;
- customer negotiation;
- changing terms after approval;
- stalled deals;
- discount anomalies;
- fulfillment constraints;
- billing and payment.

The supplied problem statement defines DealFlow360 around multi-tier discount governance, automatic approval routing, upsell/cross-sell recommendations, multi-warehouse fulfillment, hybrid billing, deal-health monitoring, anomaly alerts, customer portal negotiation and reporting.

The product will **not rebuild an ERP from scratch**.

Instead:

- **Odoo owns transactional truth and execution.**
- **DealFlow owns decision state, governance and orchestration.**

The central product capability is the **Deal Guardian**.

The Deal Guardian continuously evaluates a deal and answers:

1. Is the deal compliant?
2. What is its risk?
3. Why is it risky?
4. Who must approve it?
5. Can it be fulfilled?
6. What opportunity exists for upsell/cross-sell?
7. Has the deal changed enough to invalidate a previous approval?
8. What should happen next?

---

# 2. Official Problem Statement — Working Interpretation

The official DealFlow360 statement describes an intelligent, self-governing sales operations platform intended to handle:

- multi-tier discount governance and automated approval routing;
- live upsell and cross-sell recommendations while building a quotation;
- multi-warehouse fulfillment splitting and backorder handling;
- hybrid billing with one-time products mixed with recurring subscription lines;
- deal health monitoring and anomaly alerts;
- customer-facing portal negotiation on live quotations;
- sales backend configuration and reporting dashboards.

The stated goal is to go beyond a basic quote-to-invoice system and create a deal engine that enforces pricing discipline, reacts to inventory reality, handles recurring and one-time sales, and lets customers negotiate a living quotation.

The problem explicitly requires core business rules such as approval routing, discount governance, warehouse splitting and billing behavior to be implemented in application logic rather than hardcoded or faked for the demo.

The customer-facing negotiation experience must be a real separate restricted view.

The deliverables include a working application, a five-minute live demo covering at least two end-to-end flows, a one-page architecture diagram and a short future roadmap.

---

# 3. Why We Selected DealFlow360

We evaluated the three official statements:

1. Urban Furniture Accounting System
2. DealFlow360
3. PeoplePay360 HR & Payroll

## Final decision

# 🏆 DEALFLOW360 — SELECTED

The selection is based on the intersection of:

- strong Odoo reuse;
- meaningful custom engineering;
- cross-module workflow depth;
- visible automation;
- measurable business outcomes;
- strong demo potential;
- strong differentiation potential.

Urban Furniture has excellent Odoo fit but risks looking too close to standard Odoo Accounting.

PeoplePay360 has strong Odoo fit and business importance but introduces a large payroll-correctness surface.

DealFlow provides the strongest opportunity to use Odoo deeply while creating a distinctive intelligence/governance layer.

---

# 4. Strategic Positioning

## We are NOT building

- a generic CRM;
- another quotation builder;
- an AI chatbot;
- an ERP replacement;
- a custom accounting system;
- a custom inventory system;
- a custom subscription engine.

## We ARE building

> **A continuous deal-governance and orchestration layer on top of Odoo.**

### Core sentence

> **Odoo owns the transaction. DealFlow governs the transaction.**

### Strong judge-facing explanation

> **“We didn't use Odoo because we needed a database. We used Odoo because we needed an ERP.”**

---

# 5. Odoo vs DealFlow Boundary

This boundary is non-negotiable.

## 5.1 Odoo owns transactional truth

Odoo is responsible for:

- customers and contacts;
- products and variants;
- price lists;
- quotations;
- sales orders;
- sales order lines;
- warehouses;
- stock;
- pickings;
- subscriptions;
- invoices;
- payments;
- portal users;
- internal users;
- access control;
- companies.

## 5.2 DealFlow owns decision state

DealFlow is responsible for:

- deal identity;
- discount policies;
- risk assessments;
- risk factors;
- approval requests;
- approval actions;
- negotiation requests;
- negotiation changes;
- fulfillment plans;
- recommendations;
- deal-health snapshots;
- audit/event history;
- next-best-action decisions.

## Golden rule

```text
ODOO
= WHAT HAPPENED
= TRANSACTIONAL SOURCE OF TRUTH

DEALFLOW
= WHY / WHAT SHOULD HAPPEN NEXT
= DECISION STATE
```

---

# 6. What Happens If Odoo Is Removed?

If Odoo is removed, DealFlow would need to recreate:

- customer records;
- products;
- pricing;
- sales orders;
- order lines;
- warehouse management;
- stock state;
- delivery operations;
- subscriptions;
- invoices;
- payments;
- portal access;
- security;
- ERP transaction semantics.

At that point we would be rebuilding an ERP instead of solving the actual problem.

The intended architecture therefore looks like:

```text
                 DEALFLOW
            “WHAT SHOULD HAPPEN?”
                      │
                      ▼
               Decision Engine
                      │
                      ▼
                     ODOO
              “MAKE IT HAPPEN.”
```

The important asymmetry is deliberate:

- DealFlow is valuable as an intelligence/governance layer.
- Odoo is essential as the transactional and ERP execution substrate.

---

# 7. Product Vision — The Deal Guardian

The **Deal Guardian** is our one killer feature.

> **A continuous, event-driven governance engine that evaluates every material deal change and determines risk, required approval, operational feasibility and the next best action.**

It is not an AI chatbot.

It is not simply a risk score.

It is a decision system.

## Core loop

```text
DEAL STATE
    ↓
LOAD DEAL CONTEXT
    ↓
RESOLVE POLICY
    ↓
CALCULATE RISK
    ↓
DETERMINE APPROVAL
    ↓
CHECK OPERATIONAL FEASIBILITY
    ↓
GENERATE RECOMMENDATIONS
    ↓
CALCULATE DEAL HEALTH
    ↓
SELECT NEXT BEST ACTION
    ↓
EXECUTE THROUGH ODOO
    ↓
DEAL STATE CHANGES
    ↓
RE-EVALUATE
```

The product should feel like the deal is continuously governing itself.

---

# 8. Core Business Workflow

```text
Sales Rep
   ↓
Create Quotation
   ↓
Add Products
   ↓
Apply Discounts
   ↓
Deal Guardian Evaluates
   ↓
Policy / Risk / Margin Check
   ↓
Approval Required?
   ├── NO → Continue
   └── YES → Manager / Finance Approval
                     ↓
                  Approved
                     ↓
             Upsell / Cross-sell
                     ↓
           Fulfillment Planning
                     ↓
           Customer Portal
                     ↓
              Negotiation
                     ↓
              Risk Re-check
                     ↓
             Reapproval if needed
                     ↓
                 Confirmation
                     ↓
        Inventory / Subscription
                     ↓
             Invoice / Payment
                     ↓
              Deal Analytics
```

---

# 9. Personas

## 9.1 Sales Representative

Mental model:

> “Help me build and close the deal without accidentally creating a risky or impossible order.”

Needs:

- quotations;
- pipeline;
- product selection;
- discount entry;
- live margin;
- Deal Guardian;
- recommendations;
- approval status;
- fulfillment visibility;
- negotiation status.

## 9.2 Sales Manager

Mental model:

> “Show me which deals need intervention and explain why.”

Needs:

- approval queue;
- risk visibility;
- risk explanations;
- deal health;
- discount anomalies;
- stalled deals;
- approval history;
- quick actions.

## 9.3 Finance / Operations

Mental model:

> “Give me the exceptions and decisions that require operational or financial control.”

Needs:

- high-risk approvals;
- fulfillment exceptions;
- billing status;
- warehouse issues;
- audit history.

## 9.4 Customer

Mental model:

> “Show me my quote, let me request changes, and let me confirm it.”

Needs:

- secure quote;
- line-level change request;
- counter-discount request;
- status;
- confirmation.

Customers must not see internal risk scores, policy thresholds or other customers' data.

## 9.5 Admin

Mental model:

> “Configure the business policies that govern the sales engine.”

Needs:

- customer/product administration via Odoo;
- discount policies;
- customer tiers;
- approval rules;
- warehouses;
- subscription configuration;
- recommendation configuration;
- users and security.

---

# 10. Frontend Information Architecture

## Sales Rep

```text
Home
Deals
Pipeline
Quotations
Approvals
Fulfillment
Reports
```

## Manager

```text
Control Tower
All Deals
Approval Center
At-Risk Deals
Deal Health
Fulfillment
Reports
```

## Finance / Operations

```text
Operations
Approval Queue
Fulfillment
Billing
Exceptions
Deals
```

## Customer

```text
My Quotes
Quote
Negotiation
Billing
Activity
```

## Admin

```text
Configuration
Products
Pricelists
Discount Policies
Approval Policies
Warehouses
Subscription Plans
Users / Roles
```

---

# 11. Frontend Design Principles

Every screen should answer:

1. What am I looking at?
2. What changed?
3. Is something wrong?
4. Why?
5. What should I do?

The frontend should not merely visualize data. It should make governance actionable.

## Important rule

Never require a user to manually discover the next step.

Surface:

> **NEXT BEST ACTION**

Examples:

```text
Finance approval required
```

```text
Reduce service discount to restore margin
```

```text
Customer counter-offer requires reapproval
```

```text
Warehouse B is required to fulfill the order
```

---

# 12. Flagship Frontend Screens

## 12.1 Quotation Builder

This is the primary Sales Rep workspace.

The screen should have:

- customer context;
- quote lines;
- quantity controls;
- discounts;
- subtotal/total;
- live margin;
- Deal Guardian;
- recommendation panel;
- approval status.

Conceptually:

```text
┌───────────────────────────────────────────────────────────┐
│ ACME CORP · D-1024                         Save  Send  Submit│
├───────────────────────────────────────┬───────────────────┤
│ QUOTATION                             │ DEAL GUARDIAN      │
│                                       │                   │
│ Product | Qty | Price | Discount      │ 🔴 HIGH RISK      │
│ Laptop   10    ₹5L      12%            │                   │
│ Service  1     ₹1L      18%            │ Risk 61           │
│ Support  1     ₹20K     10%            │ Finance Approval  │
│                                       │                   │
│ + Add Product                         │ Why?               │
│                                       │ • Discount         │
│ Subtotal             ₹6.2L             │ • Margin           │
│ Discount             -₹0.8L            │ • Stock            │
│ Margin                18.4%            │                   │
├───────────────────────────────────────┴───────────────────┤
│ NEXT BEST ACTION                                           │
│ Add Docking Station → +₹13K projected margin [Add]       │
└───────────────────────────────────────────────────────────┘
```

## 12.2 Approval Center

Show:

- customer;
- deal amount;
- risk score;
- approval stage;
- reasons;
- audit trail;
- approve/reject/return actions.

Example:

```text
ACME CORP
₹12.4L
Risk 61

Sales Manager      ✓ Approved
Finance            ● Pending

WHY FLAGGED?
• Service discount exceeds policy
• Margin below threshold

[Approve] [Reject] [Return]
```

## 12.3 Manager Control Tower

Purpose:

> “What needs intervention?”

Core KPIs:

- total pipeline;
- at-risk deals;
- pending approvals;
- discount exposure;
- stalled deals;
- approval bottlenecks;
- fulfillment risk.

The upper portion should be an action queue, not just charts.

## 12.4 Customer Negotiation Portal

Keep it visually separate from internal screens.

Customer sees:

- quote;
- line items;
- price;
- discount;
- request changes;
- negotiation status;
- confirmation.

Customer interaction:

```text
Current discount: 18%

New requested discount:
[ 22% ]

Message:
[ We need this to fit our budget... ]

[Submit Request]
```

The portal does not directly mutate the underlying sale order.

---

# 13. Deal Guardian UX

## Safe state

```text
DEAL GUARDIAN

🟢 SAFE

Risk Score       12
Margin           24.8%
Approval         Not required

✓ Discount within policy
✓ Inventory available
✓ Healthy margin
```

## Risky state

```text
DEAL GUARDIAN

🔴 ACTION REQUIRED

Risk Score       61

WHY?
⚠ Service discount +8%
⚠ Margin below threshold
⚠ Stock split required

Finance approval required

[View Why]
```

The Guardian should remain visible in the quotation workflow.

---

# 14. Governance Engine — Your Core Backend

The governance engine is the heart of the custom product.

It should be deterministic by design.

## It owns

- policy evaluation;
- discount governance;
- risk;
- approval routing;
- reapproval;
- negotiation evaluation;
- recommendation scoring;
- fulfillment planning;
- deal health;
- next-best-action selection;
- event orchestration.

---

# 15. Deal Context

All governance decisions should operate on a normalized Deal Context.

Example:

```json
{
  "deal_id": "D-1024",
  "odoo_sale_order_id": 3812,
  "customer": {
    "id": 58,
    "tier": "Gold"
  },
  "lines": [
    {
      "odoo_line_id": 1001,
      "product_id": 72,
      "category_id": 8,
      "quantity": 10,
      "unit_price": 50000,
      "discount": 12,
      "margin": 120000
    }
  ],
  "inventory": {},
  "billing": {},
  "history": {}
}
```

No governance component should independently query random Odoo tables.

---

# 16. Policy Engine

The Policy Engine resolves the applicable business rules.

Inputs:

- customer tier;
- product category;
- company;
- effective dates;
- product-specific constraints;
- minimum margin.

Output example:

```json
{
  "allowed_discount": 10,
  "minimum_margin": 15,
  "manager_threshold": 5,
  "finance_threshold": 15
}
```

The problem statement gives examples of customer-tier ceilings and category-specific ceilings. The exact precedence rules are our design decision.

Recommended hierarchy:

```text
Most specific policy
        ↓
Customer + Category
        ↓
Customer Tier
        ↓
Global Default
```

Or use the stricter effective ceiling where appropriate.

Document the chosen rule.

---

# 17. Risk Engine

For each quote line:

```text
discount_excess = MAX(0, actual_discount - allowed_discount)
```

Then calculate weighted contributions.

Conceptual model:

```text
risk =
    discount risk
  + margin exposure
  + inventory risk
  + approval delay risk
  + other configured factors
```

The problem's blended-risk concept is line-aware and allows several small violations to accumulate.

The exact mathematical weights are a project design decision.

---

# 18. Explainable Risk

Never return only:

```text
Risk = 61
```

Return:

```json
{
  "score": 61,
  "severity": "HIGH",
  "factors": [
    {
      "type": "DISCOUNT_EXCESS",
      "contribution": 22,
      "reason": "Service discount exceeds category ceiling"
    },
    {
      "type": "MARGIN_EXPOSURE",
      "contribution": 14,
      "reason": "Projected margin is below configured threshold"
    }
  ]
}
```

Risk explanations power:

- frontend;
- approval decisions;
- audit;
- debugging;
- analytics.

---

# 19. Approval Engine

Approval should be derived from policy/risk rather than hardcoded into the UI.

Example project configuration:

```text
Risk < 20
→ Auto approve

20–50
→ Sales Manager

> 50
→ Sales Manager → Finance
```

These numerical thresholds are configurable implementation choices, not fixed official values.

---

# 20. Approval State Machine

Conceptual states:

```text
DRAFT
  ↓
EVALUATED
  ↓
PENDING_MANAGER
  ↓
PENDING_FINANCE
  ↓
APPROVED
```

Alternative paths:

```text
PENDING_MANAGER
  ↓
REJECTED
```

```text
PENDING_MANAGER
  ↓
RETURN_FOR_REVISION
  ↓
DRAFT
```

Critical path:

```text
APPROVED
  ↓
MATERIAL DEAL CHANGE
  ↓
RE-EVALUATE
  ↓
PREVIOUS APPROVAL INVALID
  ↓
PENDING_APPROVAL
```

---

# 21. Material Change Engine

Do not use:

```text
if anything_changed:
    invalidate_approval
```

Instead create:

```text
is_material_change(event)
```

Candidate material changes:

- discount changed;
- quantity changed;
- product added;
- product removed;
- customer counteroffer;
- payment terms changed;
- subscription terms changed;
- fulfillment risk changed.

The exact materiality rule is a project decision.

---

# 22. Recommendation Engine

Recommendations are decision support, not business truth.

Initial deterministic scoring model:

```text
recommendation_score =
    co_purchase_score
  + promotion_score
  + margin_score
  + relevance_score
```

Example:

```text
Docking Station

Co-purchase: 0.82
Promotion:   0.10
Margin:      0.90

Final score: 0.84
```

Return the top few recommendations.

---

# 23. Recommendation Explainability

Bad:

> Recommended: Docking Station

Good:

> Recommended because similar deals frequently include Docking Station and the addition improves projected margin.

The user must understand why the system suggested something.

---

# 24. Fulfillment Planner

Inputs:

- product;
- requested quantity;
- stock by warehouse;
- shipping-cost weighting.

Output example:

```json
{
  "allocations": [
    {
      "warehouse_id": 1,
      "quantity": 9
    },
    {
      "warehouse_id": 2,
      "quantity": 6
    }
  ],
  "shipments": 2,
  "estimated_cost": 7200
}
```

Initial algorithm:

1. Find warehouses with usable stock.
2. Rank candidates.
3. Allocate until demand is satisfied.
4. Remaining quantity becomes backorder.
5. Validate allocation.
6. Allow manual override.

Do not build sophisticated operations research unless the basic workflow is already stable.

---

# 25. Deal Health

Deal health is a monitoring layer.

Inputs can include:

- quote age;
- approval delay;
- discount anomaly;
- inventory risk;
- negotiation activity;
- delivery slippage.

Conceptual score:

```text
health =
    quote staleness
  + approval delay
  + discount anomaly
  + inventory risk
  + negotiation activity
```

Map to:

```text
0–30    HEALTHY
31–60   WATCH
61–100  AT_RISK
```

The exact weights are project decisions.

---

# 26. Next Best Action

All governance outputs should converge into a single actionable decision.

Examples:

```text
Finance approval required
```

```text
Reduce service discount
```

```text
Add Premium Support
```

```text
Accept warehouse allocation
```

```text
Follow up with customer
```

```text
Reapproval required after negotiation
```

This is the final user-facing output of the Deal Guardian.

---

# 27. Event-Driven Architecture

Material deal changes should trigger evaluation.

Conceptual event types:

```text
DEAL_CREATED
DISCOUNT_CHANGED
LINE_ADDED
LINE_REMOVED
QUANTITY_CHANGED
CUSTOMER_NEGOTIATED
APPROVAL_COMPLETED
STOCK_CHANGED
ORDER_STALLED
```

Flow:

```text
EVENT
  ↓
DEAL CONTEXT
  ↓
DEAL GUARDIAN
  ↓
POLICY
  ↓
RISK
  ↓
DECISION
  ↓
ACTION
  ↓
AUDIT
```

---

# 28. Idempotency

Events can arrive more than once.

Avoid:

- duplicate approvals;
- duplicate audit events;
- duplicate notifications;
- repeated transitions.

Use event IDs or unique processing keys.

---

# 29. Database Architecture

## DealFlow-owned entities

```text
deal
discount_policy
risk_assessment
risk_factor
approval_request
approval_action
negotiation_request
negotiation_change
fulfillment_plan
fulfillment_plan_line
recommendation
deal_health_snapshot
audit_event
```

## Odoo references

```text
odoo_partner_id
odoo_product_id
odoo_product_category_id
odoo_sale_order_id
odoo_sale_order_line_id
odoo_warehouse_id
odoo_invoice_id
```

Do not duplicate core Odoo transactional objects.

---

# 30. Central Entity — Deal

The central DealFlow entity should map to the Odoo sales order.

```text
deal
----
id                  UUID PK
odoo_sale_order_id  BIGINT UNIQUE
odoo_partner_id     BIGINT
owner_user_id       BIGINT
company_id          BIGINT
status
approval_state
health_status
current_risk_score
created_at
updated_at
```

One DealFlow deal can have many:

- risk assessments;
- approval requests;
- negotiation requests;
- fulfillment plans;
- recommendations;
- health snapshots;
- audit events.

---

# 31. Discount Policy

```text
discount_policy
----------------
id
name
company_id
customer_tier
product_category_id
max_discount_pct
manager_threshold
finance_threshold
minimum_margin_pct
priority
active
effective_from
effective_to
created_at
updated_at
```

Policy values are configurable.

Avoid hardcoded business rules.

---

# 32. Risk Assessment

```text
risk_assessment
----------------
id
deal_id
risk_score
severity
decision
trigger_type
policy_version
calculated_at
```

Every material evaluation creates a historical assessment.

---

# 33. Risk Factor

```text
risk_factor
-----------
id
risk_assessment_id
factor_type
source_reference
raw_value
weight
contribution
reason
```

This makes risk explainable.

---

# 34. Approval Model

```text
approval_request
----------------
id
deal_id
risk_assessment_id
required_level
sequence
status
requested_at
completed_at
expires_at
```

```text
approval_action
---------------
id
approval_request_id
actor_user_id
action
reason
created_at
```

Actions:

```text
APPROVE
REJECT
RETURN
ESCALATE
```

---

# 35. Negotiation Model

```text
negotiation_request
-------------------
id
deal_id
odoo_sale_order_id
customer_partner_id
requested_by
status
message
created_at
processed_at
```

```text
negotiation_change
------------------
id
negotiation_request_id
odoo_sale_order_line_id
field_name
old_value
requested_value
```

Customer changes are proposals, not direct mutations of Odoo sales orders.

---

# 36. Fulfillment Model

```text
fulfillment_plan
----------------
id
deal_id
odoo_sale_order_id
status
estimated_shipments
estimated_shipping_cost
algorithm_version
generated_at
```

```text
fulfillment_plan_line
---------------------
id
fulfillment_plan_id
odoo_product_id
odoo_warehouse_id
requested_qty
allocated_qty
backorder_qty
shipping_cost
```

Key invariant:

```text
allocated_qty + backorder_qty = requested_qty
```

---

# 37. Recommendation Model

```text
recommendation
--------------
id
deal_id
odoo_product_id
recommendation_type
score
margin_delta
reason
source
status
created_at
dismissed_at
```

---

# 38. Deal Health Model

```text
deal_health_snapshot
--------------------
id
deal_id
health_status
overall_score
stalled_score
discount_anomaly_score
delivery_risk_score
approval_delay_score
calculated_at
```

History is preserved.

---

# 39. Audit Event Model

```text
audit_event
-----------
id
deal_id
event_type
actor_type
actor_id
entity_type
entity_id
before_state
after_state
reason
metadata
created_at
```

Possible event types:

```text
DEAL_CREATED
DISCOUNT_CHANGED
RISK_RECALCULATED
APPROVAL_CREATED
APPROVAL_APPROVED
APPROVAL_REJECTED
NEGOTIATION_RECEIVED
APPROVAL_INVALIDATED
FULFILLMENT_REPLANNED
ORDER_CONFIRMED
INVOICE_CREATED
PAYMENT_RECEIVED
```

---

# 40. Database Integrity Rules

## Risk

```text
0 <= risk_score <= 100
```

## Discount

```text
0 <= max_discount_pct <= 100
```

## Quantity

```text
requested_qty >= 0
allocated_qty >= 0
backorder_qty >= 0
```

## Approval

Only one active approval stage should exist for a deal at a time.

## Negotiation

A negotiation cannot bypass required approval.

## History

Material decisions create an auditable historical record.

---

# 41. Database Indexing

At minimum:

```text
deal:
    UNIQUE(odoo_sale_order_id)
    INDEX(odoo_partner_id)
    INDEX(status)
    INDEX(approval_state)
    INDEX(health_status)

risk_assessment:
    INDEX(deal_id, calculated_at)
    INDEX(risk_score)

approval_request:
    INDEX(deal_id, status)
    INDEX(required_level, status)

negotiation_request:
    INDEX(deal_id, status)
    INDEX(customer_partner_id)

audit_event:
    INDEX(deal_id, created_at)
    INDEX(event_type, created_at)
```

---

# 42. History vs Current State

## Current state

Use current-state fields for fast operational reads:

```text
deal.current_risk_score
deal.health_status
deal.approval_state
```

## Historical state

Use dedicated records for:

```text
risk_assessment
deal_health_snapshot
approval_action
audit_event
```

The system therefore supports both fast UI reads and full reconstruction of what happened.

---

# 43. Odoo Integration Layer

The Odoo Integration Engineer owns:

- Odoo environment;
- module verification;
- Odoo-side model extensions;
- API/service adapter;
- portal security;
- transaction execution;
- inventory integration;
- subscription integration;
- accounting integration;
- Odoo seed data.

---

# 44. Odoo Models to Reuse

Use native Odoo concepts for:

```text
res.partner
product.template
product.product
product.category
sale.order
sale.order.line
stock.warehouse
stock.quant
stock.picking
account.move
account.payment
subscription-related records
users / groups
```

Exact subscription model names must be verified against the actual installed version.

---

# 45. Odoo Integration Rules

Never duplicate:

- customers;
- products;
- orders;
- stock;
- invoices;
- payments;
- subscriptions.

Instead reference:

```text
odoo_partner_id
odoo_product_id
odoo_sale_order_id
odoo_sale_order_line_id
odoo_warehouse_id
```

---

# 46. Odoo Transaction Safety

For multi-step transactional operations, prefer server-side Odoo methods when atomicity matters.

Example:

```text
Approve
   ↓
Update Odoo state
   ↓
Confirm order
```

should not leave the ERP half-updated.

Avoid chains of independent API calls when one atomic Odoo-side method is more appropriate.

---

# 47. Portal Security

Correct model:

```text
Customer
   ↓
Odoo Portal
   ↓
Negotiation Request
   ↓
DealFlow
   ↓
Risk Recalculation
   ↓
Approval
   ↓
Odoo Sale Order Update
```

Do NOT allow:

```text
Customer
   ↓
Directly edit sale.order
```

---

# 48. API Architecture

Recommended structure:

```text
Frontend
    ↓
DealFlow API
    ↓
Governance Engine
    ↓
Repository / Service Layer
    ↓
Odoo Integration
    ↓
Odoo
```

Frontend never directly manipulates the DealFlow database.

Governance logic does not depend directly on Odoo ORM calls.

---

# 49. Suggested API

## Deal

```http
GET /api/deals/{deal_id}
GET /api/deals/{deal_id}/workspace
```

## Evaluation

```http
POST /api/deals/{deal_id}/evaluate
```

## Approval

```http
GET  /api/deals/{deal_id}/approval
POST /api/deals/{deal_id}/approval/approve
POST /api/deals/{deal_id}/approval/reject
POST /api/deals/{deal_id}/approval/return
```

## Negotiation

```http
POST /api/deals/{deal_id}/negotiations
```

## Recommendation

```http
GET /api/deals/{deal_id}/recommendations
```

## Fulfillment

```http
GET /api/deals/{deal_id}/fulfillment
POST /api/deals/{deal_id}/fulfillment/apply
```

## Health

```http
GET /api/deals/{deal_id}/health
```

---

# 50. Recommended Workspace Response

To minimize frontend round trips:

```http
GET /api/deals/{id}/workspace
```

should return:

```json
{
  "deal": {},
  "customer": {},
  "quote": {},
  "risk": {},
  "approval": {},
  "health": {},
  "recommendations": [],
  "fulfillment": {},
  "billing": {},
  "next_best_action": {}
}
```

---

# 51. Four-Person Team

## Person 1 — DB / Data Architect

Owns:

- canonical data model;
- ERD;
- schema;
- relationships;
- constraints;
- indexes;
- migrations;
- seed data;
- data contracts;
- historical state.

Mission:

> **Protect the integrity of DealFlow's data architecture.**

## Person 2 — Odoo Integration Engineer

Owns:

- Odoo module;
- Odoo models;
- API/service adapter;
- Sales;
- Inventory;
- Subscription;
- Accounting;
- Portal;
- security;
- Odoo-side automation;
- Odoo seed data.

Mission:

> **Make Odoo the real transaction engine underneath DealFlow.**

## Person 3 — Deal Governance Engineer

Owns:

- Policy Engine;
- Risk Engine;
- Approval Engine;
- Reapproval;
- Recommendation scoring;
- Fulfillment planning;
- Deal Health;
- Next Best Action;
- event orchestration.

Mission:

> **Build the brain that decides whether a deal is safe and what should happen next.**

## Person 4 — Frontend / UX Engineer

Owns:

- sales workspace;
- quotation builder;
- Deal Guardian UI;
- approval center;
- control tower;
- fulfillment UI;
- customer portal;
- reports;
- loading/error states;
- role-based navigation.

Mission:

> **Make complex governance understandable and actionable.**

---

# 52. Team Dependency Model

```text
                   DB ARCHITECT
                        │
             ┌──────────┴──────────┐
             ▼                     ▼
       ODOO INTEGRATION      GOVERNANCE ENGINE
             │                     │
             └──────────┬──────────┘
                        ▼
                   FRONTEND / UX
```

Frontend development can begin against mocked API contracts so the UI is not blocked.

---

# 53. Canonical Vocabulary

| Concept | Canonical name |
|---|---|
| Deal | `deal` |
| Discount policy | `discount_policy` |
| Risk result | `risk_assessment` |
| Risk explanation | `risk_factor` |
| Approval workflow | `approval_request` |
| Approval decision | `approval_action` |
| Negotiation | `negotiation_request` |
| Negotiation field change | `negotiation_change` |
| Fulfillment plan | `fulfillment_plan` |
| Fulfillment allocation | `fulfillment_plan_line` |
| Recommendation | `recommendation` |
| Health history | `deal_health_snapshot` |
| History | `audit_event` |

No team member should create alternative names for the same concept.

---

# 54. AI Strategy

## Core business decisions must be deterministic

Do NOT use AI for:

- discount approval;
- accounting truth;
- invoice correctness;
- payment state;
- stock truth;
- permission enforcement.

These should be deterministic.

## Optional intelligent assistance

AI may enhance:

- recommendation ranking;
- narrative explanation;
- anomaly interpretation;
- sales insights.

But:

> **AI can recommend. Business policy decides.**

The system must remain useful without AI.

---

# 55. Why Deterministic Rules Are the Right Core

The source problem explicitly requires application logic for core business rules and provides deterministic examples of discount ceilings, line-level violations and approval routing.

Deterministic rules give us:

- reproducibility;
- explainability;
- auditability;
- reliable testing;
- predictable demo behavior;
- low latency;
- scalable evaluation.

A risky quote should produce the same risk under the same inputs.

That is much more defensible than an LLM making a governance decision.

---

# 56. Decision Engine Internal Architecture

```text
             DEAL CONTEXT
                  │
                  ▼
           POLICY RESOLVER
                  │
                  ▼
            RISK ENGINE
                  │
          ┌───────┴────────┐
          ▼                ▼
   APPROVAL ENGINE    RECOMMENDER
          │                │
          └───────┬────────┘
                  ▼
          FULFILLMENT / HEALTH
                  │
                  ▼
           NEXT BEST ACTION
                  │
                  ▼
                ODOO
```

---

# 57. Governance API Contract

The frontend should consume a decision-oriented response rather than raw DB rows.

Example:

```json
{
  "deal_id": "D-1024",
  "risk": {
    "score": 61,
    "severity": "HIGH",
    "factors": []
  },
  "approval": {
    "required": true,
    "level": "FINANCE",
    "status": "PENDING"
  },
  "health": {
    "status": "AT_RISK",
    "score": 72
  },
  "recommendations": [],
  "fulfillment": {},
  "next_best_action": {
    "type": "FINANCE_APPROVAL",
    "priority": "HIGH"
  }
}
```

---

# 58. Failure Surface

## Biggest technical risk

Cross-module state consistency.

```text
Sales
↕
Governance
↕
Inventory
↕
Subscriptions
↕
Accounting
↕
Portal
```

## Mitigation

- build the Odoo integration early;
- verify hybrid billing in the first hour;
- use deterministic decision rules;
- keep state transitions explicit;
- make event processing idempotent;
- preserve audit history;
- use atomic Odoo-side operations when needed.

---

# 59. Critical Test Cases

## Discount

```text
Within allowed ceiling
→ no approval
```

```text
Above manager threshold
→ manager approval
```

```text
Above finance threshold
→ manager → finance
```

## Mixed categories

```text
Hardware 12%
Service 18%
```

The service line can independently breach its category ceiling.

## Blended risk

Several smaller violations can combine into a higher overall risk.

## Reapproval

```text
Approved
→ material customer discount change
→ approval invalidated
→ new approval
```

## Fulfillment

```text
Requested 15
Warehouse A 9
Warehouse B 6
→ valid plan
```

## Portal security

Customer A cannot see Customer B's quote.

## Recommendation

Healthy-margin and contextually relevant recommendations should rank above irrelevant products.

## Audit

Every material decision has:

- actor;
- timestamp;
- event;
- reason.

---

# 60. The Golden End-to-End Test

Run this path continuously throughout implementation:

```text
CREATE QUOTE
     ↓
18% SERVICE DISCOUNT
     ↓
RISK = HIGH
     ↓
FINANCE APPROVAL
     ↓
APPROVE
     ↓
CUSTOMER COUNTER-OFFER
22%
     ↓
RISK RECALCULATED
     ↓
PREVIOUS APPROVAL INVALID
     ↓
FINANCE AGAIN
```

If this breaks, stop feature expansion and fix it.

---

# 61. Killer Demo

## 90-second core sequence

### Step 1 — Create quote

```text
ACME Corp
Gold Tier
₹12.4L
```

### Step 2 — Risky discount

Rep sets service discount:

```text
18%
```

Guardian immediately shows:

```text
🔴 Risk 61
Finance approval required

Service discount exceeds policy.
```

### Step 3 — Recommendation

Guardian says:

```text
Add Docking Station
Projected margin +₹13K
```

Rep adds it and sees the margin change.

### Step 4 — Approval

Manager approves.

### Step 5 — Fulfillment

System proposes:

```text
Main Warehouse → 9
East Depot     → 6
```

### Step 6 — Customer negotiation

Customer requests:

```text
22% discount
```

### Step 7 — Killer moment

Guardian recalculates:

```text
Risk
31 → 61

Previous approval invalidated.

Finance approval required again.
```

### Step 8 — Control Tower

Manager sees the deal as at risk and sees the exact reason.

This single story demonstrates:

```text
Sales
→ Governance
→ Risk
→ Approval
→ Intelligence
→ Fulfillment
→ Customer
→ Reapproval
→ Management
```

---

# 62. Why the Killer Demo Works

The demo is designed to visually express the core problem statement rather than show disconnected features.

One deal is the protagonist.

The deal changes state.

Every important state change triggers governance.

The judge sees:

- policy enforcement;
- explainable risk;
- approval routing;
- recommendations;
- operational planning;
- customer collaboration;
- automatic reapproval;
- management visibility.

---

# 63. 24-Hour Sprint

## Hour 0–1 — Feasibility / Architecture Spike

All:

- confirm Odoo version;
- verify required modules;
- inspect repository;
- agree architecture;
- freeze API boundaries.

Odoo engineer verifies:

- Sales;
- Inventory;
- Accounting;
- Subscriptions;
- Portal;
- mixed recurring + one-time behavior.

DB Architect freezes:

- schema boundary;
- ERD;
- IDs;
- invariants.

Governance Engineer freezes:

- policy model;
- risk formula;
- approval states;
- material-change rules.

Frontend Engineer freezes:

- navigation;
- key screens;
- Deal Guardian structure;
- API mock contract.

## Hour 1–3 — Foundation

### DB

Implement:

```text
deal
discount_policy
risk_assessment
risk_factor
approval_request
approval_action
audit_event
```

### Odoo

Implement:

- module;
- Sale Order integration;
- customer/product access;
- API adapter;
- security foundation.

### Governance

Implement:

```text
Deal Context
Policy Resolver
Risk Engine
Approval Decision
```

### Frontend

Implement:

- app shell;
- quote workspace;
- Deal Guardian;
- basic deal page.

## Hour 3 Gate

The following must work:

```text
Odoo Sale Order
      ↓
DealFlow Deal
      ↓
Policy
      ↓
Risk
      ↓
Approval Requirement
      ↓
Audit Event
```

If this does not work, do not expand scope.

## Hour 3–6

Build:

- approval state machine;
- approval actions;
- approval invalidation;
- negotiation schema;
- negotiation service;
- audit events.

Frontend:

- approval center;
- approval detail;
- timeline.

Odoo:

- approval lock;
- integration actions.

## Hour 6–9

Build:

- recommendation engine;
- deal health;
- next-best-action;
- fulfillment planner.

Frontend:

- recommendation panel;
- fulfillment UI;
- health indicators.

## Hour 9–12

Build:

- customer portal;
- negotiation flow;
- subscription/billing visualization;
- Odoo subscription integration;
- invoice/payment status.

Run the end-to-end path.

## Hour 12–15

Integration hardening:

```text
DealFlow decision
     ↓
Odoo action
     ↓
new Odoo state
     ↓
event
     ↓
DealFlow re-evaluation
```

## Hour 15–18

Polish:

- Control Tower;
- risk explanations;
- deal timeline;
- notification states;
- error states;
- responsive layout.

## Hour 18–20

Full testing:

- clean deal;
- risky deal;
- finance approval;
- rejected approval;
- returned deal;
- customer negotiation;
- reapproval;
- warehouse split;
- backorder;
- billing;
- portal security.

## Hour 20–22

Demo stabilization:

- seeded deals;
- known users;
- known roles;
- known stock;
- known customer accounts;
- deterministic recommendation data.

## Hour 22–24

Freeze.

Only:

- bug fixes;
- security fixes;
- demo reliability;
- presentation.

---

# 64. MUST HAVE

## Product

- Deal;
- discount policy;
- risk engine;
- explainable risk factors;
- automatic approval routing;
- reapproval;
- audit trail;
- recommendation;
- fulfillment plan;
- customer negotiation;
- deal health;
- Odoo integration.

## UI

- quotation builder;
- Deal Guardian;
- approval center;
- customer portal;
- manager control tower.

## Integration

- Odoo customer;
- product;
- sales order;
- inventory;
- billing;
- portal.

---

# 65. SHOULD HAVE

- richer anomaly detection;
- approval-delay analytics;
- automated nudges;
- improved recommendation ranking;
- fulfillment cost visualization;
- advanced dashboard filters;
- richer billing schedule UI.

---

# 66. CUT IF BEHIND

1. LLM chatbot.
2. ML risk model.
3. Reinforcement learning.
4. Custom CRM.
5. Custom subscription engine.
6. Advanced logistics optimization.
7. Multi-company polish.
8. Multi-currency.
9. External payment integration.
10. Mobile app.
11. Complex animations.
12. Microservices.

---

# 67. What We Must Not Build

## A second ERP

Do not duplicate:

- customer;
- product;
- sales;
- stock;
- invoice;
- payment;
- subscription.

## A giant frontend

Do not build a separate product that merely happens to talk to Odoo.

## AI-first business decisions

AI should not decide accounting, authorization or policy compliance.

## Microservice circus

One DealFlow backend is enough for the finale.

## Over-optimization

Do not turn warehouse allocation into a research project.

---

# 68. Generic Web App Test

Question:

> “If we replaced Odoo with Django/Node/Spring, would most of the project remain unchanged?”

Our intended answer:

> **No.**

DealFlow depends on a real ERP transaction graph:

```text
Sales
Inventory
Subscriptions
Accounting
Portal
Contacts
Security
```

DealFlow governs the interactions across those systems.

The custom layer is not replacing them.

It is orchestrating them.

---

# 69. Scalability Strategy

## Data scalability

Use normalized relational data and indexed historical records.

## Workflow scalability

Represent approval, negotiation and fulfillment as configurable domain workflows.

## Organizational scalability

Support:

- customer tiers;
- configurable policies;
- role-based approval;
- company context.

## Extensibility

Keep:

- policy engine;
- risk engine;
- approval engine;
- recommendation engine;
- fulfillment planner

as independent modules/services within one deployable backend.

## Integration scalability

Use adapters around Odoo rather than coupling every rule directly to Odoo internals.

---

# 70. Maintainability Principles

1. Odoo business truth stays in Odoo.
2. DealFlow decisions stay in DealFlow.
3. Business rules are configurable.
4. Rules are explainable.
5. Important decisions are historical.
6. Frontend never owns business logic.
7. Governance logic should be unit-testable without Odoo.
8. Odoo integration should be replaceable behind an adapter.
9. Avoid raw SQL unless genuinely needed.
10. Avoid unnecessary custom controllers.

---

# 71. Judge Questions We Should Expect

## “Why Odoo?”

> Odoo provides the ERP transaction graph—customers, products, quotations, inventory, subscriptions, invoices, payments, portal and security. We use it as the source of transactional truth rather than rebuilding those components.

## “Why not put everything inside Odoo?”

> The problem allows an independent backend. We keep Odoo's transactional responsibilities in Odoo and isolate the new decision/governance domain in DealFlow so the custom business logic is modular, testable and extensible.

## “Why deterministic rules instead of AI?”

> Policy decisions need explainability, repeatability and auditability. AI may assist recommendations, but business policy remains deterministic.

## “What happens if the customer changes the deal after approval?”

> The change creates a negotiation request. DealFlow re-evaluates the deal. If the new state is outside the scope of the previous approval, that approval is invalidated and a new approval chain is created.

## “What if your AI recommendation is wrong?”

> The recommendation is advisory. It cannot override business policy or transactional truth.

## “What makes this different from a normal CRM?”

> A normal CRM records the deal. DealFlow continuously governs the deal.

---

# 72. Presentation Narrative

## Opening

> “Traditional sales systems stop at quote-to-order. Real B2B deals are messier: discounts require governance, inventory changes, customers negotiate and deal risk evolves after approval.”

## Problem

Show a deal with an unsafe discount.

## Solution

Introduce the Deal Guardian.

## Demo

Show:

```text
Discount
→ Risk
→ Approval
→ Recommendation
→ Fulfillment
→ Negotiation
→ Reapproval
```

## Architecture

Say:

> “Odoo owns the transaction. DealFlow governs the transaction.”

## Technical depth

Explain:

- deterministic policy engine;
- historical risk assessments;
- approval state machine;
- Odoo integration;
- secure negotiation request model;
- event-driven re-evaluation.

## Closing

> **“Instead of asking salespeople to manage the complexity of every deal, DealFlow continuously manages the complexity around them.”**

---

# 73. Final Product Architecture

```text
                         USERS
                           │
            ┌──────────────┼───────────────┐
            │              │               │
         SALES REP      MANAGER         CUSTOMER
            │              │               │
            └──────────────┼───────────────┘
                           ▼
                ┌────────────────────┐
                │ DEALFLOW EXPERIENCE│
                │                    │
                │ Quote Workspace    │
                │ Control Tower      │
                │ Approval Center    │
                │ Customer Portal    │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │  DEALFLOW API      │
                │ / ORCHESTRATOR     │
                └─────────┬──────────┘
                          │
                          ▼
                ┌────────────────────┐
                │   DEAL GUARDIAN    │
                │                    │
                │ Policy             │
                │ Risk               │
                │ Approval           │
                │ Recommendation     │
                │ Fulfillment        │
                │ Deal Health        │
                │ Next Best Action   │
                └─────────┬──────────┘
                          │
                 ┌────────┴────────┐
                 ▼                 ▼
       ┌─────────────────┐  ┌──────────────────┐
       │ DEALFLOW DB     │  │ ODOO INTEGRATION │
       │                 │  │                  │
       │ Deals           │  │ Sales            │
       │ Policies        │  │ Inventory        │
       │ Risk            │  │ Subscriptions    │
       │ Approvals       │  │ Accounting       │
       │ Negotiations    │  │ Portal           │
       │ Fulfillment     │  │ Contacts         │
       │ Recommendations │  │ Security         │
       │ Health          │  │                  │
       │ Audit           │  │                  │
       └─────────────────┘  └────────┬─────────┘
                                     │
                                     ▼
                                ODOO ERP
                     Transactional Source of Truth
```

---

# 74. Final Strategic Thesis

## WINNING THESIS

> **DealFlow360 turns Odoo from a system that records sales into a system that continuously governs them—protecting margin, enforcing policy, adapting to customer negotiation and operational reality, and deciding what should happen next.**

## KILLER DEMO

> **A risky discount automatically triggers governance, a profitable recommendation appears, inventory is intelligently allocated, the customer counters through the portal, the system detects that the deal has become unsafe and automatically reopens approval.**

---

# 75. Five Things Most Likely to Waste the 24 Hours

1. Building a second ERP instead of using Odoo.
2. Building a separate frontend stack that duplicates Odoo capabilities.
3. Building an unnecessary AI/LLM layer.
4. Over-engineering warehouse optimization.
5. Adding features after the golden end-to-end path is already working.

---

# 76. First Three Hours

By the end of Hour 3, the team must have:

```text
1. Canonical DealFlow schema
2. Odoo integration foundation
3. Real Sale Order → Deal mapping
4. Deal Context
5. Discount Policy resolution
6. Deterministic Risk calculation
7. Approval determination
8. Audit event
9. Basic Deal Guardian UI
10. Verified mixed recurring + one-time billing feasibility
```

The first working milestone is:

```text
Odoo Quote
    ↓
DealFlow Deal
    ↓
Policy Evaluation
    ↓
Risk Score
    ↓
Approval Required?
    ↓
Audit Event
```

Do not expand scope before this is reliable.

---

# 77. Non-Negotiable Architecture Principles

### Principle 1
**Odoo is the source of transactional truth.**

### Principle 2
**DealFlow is the source of decision state.**

### Principle 3
**Business policy is deterministic and explainable.**

### Principle 4
**AI is advisory, never authoritative for core business truth.**

### Principle 5
**Material changes trigger re-evaluation.**

### Principle 6
**Every important decision is auditable.**

### Principle 7
**Frontend displays decisions; it does not make them.**

### Principle 8
**No duplicate ERP entities.**

### Principle 9
**One DealFlow backend, not a microservice zoo.**

### Principle 10
**Optimize the golden demo path before optional features.**

---

# 78. Final Team Mantra

```text
ODOO
stores the transaction.

DEALFLOW
understands the deal.

DEAL GUARDIAN
decides what happens next.

USERS
make the final business decisions.

EVERYTHING
stays explainable.
```

---

# 79. Source Alignment Note

This master document is primarily grounded in the supplied DealFlow360 problem statement and our locked project strategy.

The source explicitly defines the required sales, approval, inventory, subscription, negotiation and reporting capabilities.

The exact numerical risk formula, health-score weights, policy precedence, database technology, API implementation and internal architecture are **our engineering decisions**, not claimed to be dictated by the official statement.
