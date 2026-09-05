# DealFlow360 — Team Task Checklist

> **Master Execution Checklist for the 24-Hour Odoo Finale Hackathon**  
> *Core Doctrine: "Odoo owns transactions. DealFlow owns decisions. Deal Guardian governs deal state."*

---

## How to Use This File

1. **Ownership**: Each team member is solely responsible for checking off tasks in their assigned domain (Agent 1: Database, Agent 2: Odoo Integration, Agent 3: Deal Governance, Agent 4: Frontend/UX).
2. **Verification Before Completion**: Only mark a task complete (from unchecked to checked) after its acceptance criteria are strictly satisfied and verified via automated test or live demonstration.
3. **No Pre-Checking**: Do not check off tasks merely because draft code or scaffolded files exist in the repository.
4. **Integration Sign-Off**: Cross-agent integration tasks require explicit sign-off from both connected workstream owners before checking.
5. **Format**: Key tasks follow the standard metadata block:
   ```markdown
   - [ ] **TASK-ID — Task Name**
     - Owner: Agent X
     - Priority: P0 / P1 / P2
     - Dependency: [Pre-requisite tasks]
     - Acceptance: [Explicit conditions for completion]
     - Verification: [Automated test command or inspection step]
   ```

---

## GLOBAL MILESTONES

- [ ] **MS-01 — Contract Freeze**: All four domain boundaries, DealContext schemas, and API DTOs frozen
- [ ] **MS-02 — Database Foundation Ready**: PostgreSQL schema migrated and repository layer accessible
- [ ] **MS-03 — Odoo Integration Ready**: Odoo RPC adapter reading partners, products, orders, and stock
- [ ] **MS-04 — Deal Guardian Ready**: Policy, Risk, FSM, Invalidation, Recommendations, and NBA verified
- [ ] **MS-05 — Core UI Ready**: Sales Rep Workspace and Manager Control Tower connected to API
- [ ] **MS-06 — Customer Negotiation Ready**: Customer portal submitting counteroffers to Guardian
- [ ] **MS-07 — End-to-End Integration Ready**: Frontend ↔ Guardian ↔ Odoo ↔ PostgreSQL flow verified
- [ ] **MS-08 — Golden Demo Passes**: 5-minute unscripted golden scenario passes without glitches
- [ ] **MS-09 — Demo Reset/Recovery Tested**: Deterministic teardown and seed restore scripts verified
- [ ] **MS-10 — Code Freeze**: Zero non-critical commits 2 hours prior to final presentation
- [ ] **MS-11 — Final Rehearsal Complete**: Presentation and live demo rehearsed end-to-end

---

## AGENT 1 — DATABASE

### Foundation
- [ ] **DB-01 — Database Project Structure**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: None
  - Acceptance: Directory layout under `backend/app/models/` and `backend/app/db/` established
  - Verification: Directory inspection and clean Python module imports
- [ ] **DB-02 — SQLAlchemy 2.0 Base & Configuration**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-01
  - Acceptance: Async/sync engine configured, declarative base established, session factory created
  - Verification: Connection smoke test against PostgreSQL instance
- [ ] **DB-03 — PostgreSQL Connection Setup**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-02
  - Acceptance: Environment variable configuration for `DATABASE_URL` with connection pooling
  - Verification: Connect test script succeeds without authentication errors
- [ ] **DB-04 — Alembic Migration Environment**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-02
  - Acceptance: `alembic.ini` and `env.py` configured with SQLAlchemy metadata target
  - Verification: `alembic current` runs cleanly without exceptions
- [ ] **DB-05 — Initial Migration Generation**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-04, Core Entities
  - Acceptance: Baseline migration script creates all 13 core DealFlow tables cleanly
  - Verification: `alembic upgrade head` succeeds on a fresh PostgreSQL database

### Core Entities
- [ ] **DB-ENT-01 — Deal Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-02
  - Acceptance: Table `deal` with `id`, `odoo_order_id`, `state`, `approved_baseline`, timestamps
  - Verification: Unit test inserting and querying a Deal record
- [ ] **DB-ENT-02 — Discount Policy Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-02
  - Acceptance: Table `discount_policy` with `tier`, `category_id`, `max_discount`, `requires_approval`
  - Verification: Unit test querying policy by customer tier and category
- [ ] **DB-ENT-03 — Risk Assessment Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-ENT-01
  - Acceptance: Table `risk_assessment` with `deal_id`, `blended_score`, `severity`, `deal_version`
  - Verification: Unit test inserting assessment linked to deal
- [ ] **DB-ENT-04 — Risk Factor Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-ENT-03
  - Acceptance: Table `risk_factor` with `assessment_id`, `category`, `score_impact`, `explanation`
  - Verification: Foreign key cascade query test from risk assessment
- [ ] **DB-ENT-05 — Approval Request Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-ENT-01
  - Acceptance: Table `approval_request` with `deal_id`, `required_role`, `state`, `deal_version`
  - Verification: Query pending requests by role
- [ ] **DB-ENT-06 — Approval Action Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-ENT-05
  - Acceptance: Table `approval_action` with `request_id`, `actor_id`, `action`, `notes`, `created_at`
  - Verification: Audit trail query of actions on an approval request
- [ ] **DB-ENT-07 — Negotiation Request Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-ENT-01
  - Acceptance: Table `negotiation_request` with `deal_id`, `customer_id`, `status`, `submitted_at`
  - Verification: Insert and query negotiation proposals
- [ ] **DB-ENT-08 — Negotiation Change Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-ENT-07
  - Acceptance: Table `negotiation_change` with `line_id`, `original_discount`, `proposed_discount`
  - Verification: Query delta records for a negotiation
- [ ] **DB-ENT-09 — Fulfillment Plan Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-ENT-01
  - Acceptance: Table `fulfillment_plan` with `deal_id`, `status`, `split_required`, `created_at`
  - Verification: Insert plan and verify relationship to deal
- [ ] **DB-ENT-10 — Fulfillment Plan Line Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-ENT-09
  - Acceptance: Table `fulfillment_plan_line` with `product_id`, `warehouse_id`, `allocated_qty`
  - Verification: Check line sum equals plan total
- [ ] **DB-ENT-11 — Recommendation Model**
  - Owner: Agent 1 (Database)
  - Priority: P1
  - Dependency: DB-ENT-01
  - Acceptance: Table `recommendation` with `deal_id`, `product_id`, `score`, `projected_margin`, `rationale`
  - Verification: Query active recommendations ordered by score descending
- [ ] **DB-ENT-12 — Deal Health Snapshot Model**
  - Owner: Agent 1 (Database)
  - Priority: P1
  - Dependency: DB-ENT-01
  - Acceptance: Table `deal_health_snapshot` with `deal_id`, `health_score`, `stalled_days`, `flags`
  - Verification: Insert snapshot and query historical trends
- [ ] **DB-ENT-13 — Audit Event Model**
  - Owner: Agent 1 (Database)
  - Priority: P0
  - Dependency: DB-02
  - Acceptance: Table `audit_event` with `event_id`, `event_type`, `deal_id`, `payload`, `timestamp`
  - Verification: Append-only insert test

### Integrity
- [ ] **DB-INT-01 — Foreign Key Relationships**: Enforce FKs with appropriate on-delete rules across all tables
- [ ] **DB-INT-02 — Business Constraints**: Check constraints on `score BETWEEN 0 AND 100`, positive quantities, discount `0 <= d <= 100`
- [ ] **DB-INT-03 — Query Indexes**: Composite indexes on `(deal_id, deal_version)`, `(state, required_role)`, and `odoo_order_id`
- [ ] **DB-INT-04 — Odoo External Reference Strategy**: Store `odoo_order_id`, `odoo_partner_id` as indexed external IDs without duplicating master data
- [ ] **DB-INT-05 — Approval State Integrity**: Prevent concurrent conflicting approval states via unique constraints or locking
- [ ] **DB-INT-06 — Fulfillment Quantity Invariant**: Ensure check constraints prevent negative allocations
- [ ] **DB-INT-07 — Audit Immutability**: Ensure `audit_event` table has no `UPDATE` or `DELETE` grants in production profile

### Repositories
- [ ] **DB-REP-01 — Deal Repository**: CRUD and deal state transitions matching `DealRepositoryProtocol`
- [ ] **DB-REP-02 — Policy Repository**: Fetch effective policies by tier and category
- [ ] **DB-REP-03 — Approval Repository**: Query pending approvals, record actions, update FSM state
- [ ] **DB-REP-04 — Risk Repository**: Save risk assessment snapshots and factor breakdowns
- [ ] **DB-REP-05 — Negotiation Repository**: Save incoming counteroffer proposals and status changes
- [ ] **DB-REP-06 — Fulfillment Repository**: Store and retrieve multi-warehouse allocation plans
- [ ] **DB-REP-07 — Recommendation Repository**: Store accretive product recommendations
- [ ] **DB-REP-08 — Health Repository**: Record health snapshots and query stalled opportunities
- [ ] **DB-REP-09 — Audit Repository**: Append-only log recording for all governance actions

### Seed / Demo
- [ ] **DB-SEED-01 — Demo Policies**: Seed customer tier policies (Platinum: 20%, Gold: 15%, Standard: 10%) and category ceilings (Hardware: 15%, Software: 20%, Services: 10%)
- [ ] **DB-SEED-02 — Demo Reference Data**: Seed demo deals matching Acme Corp golden path quote
- [ ] **DB-SEED-03 — Demo Reset Script**: Python script `reset_db.py` to restore pristine demo state in < 3 seconds
- [ ] **DB-SEED-04 — Database Verification Script**: Automated script checking all tables, rows, and constraints

### Testing
- [ ] **DB-TST-01 — Schema Migration Tests**: Test clean migration upgrade and downgrade
- [ ] **DB-TST-02 — Repository CRUD Tests**: Test all repository methods with mock/live database sessions
- [ ] **DB-TST-03 — Constraint Enforcement Tests**: Verify invalid discounts or negative quantities trigger DB errors
- [ ] **DB-TST-04 — Audit Immutability Tests**: Verify audit records cannot be mutated
- [ ] **DB-TST-05 — Seed and Reset Verification Tests**: Verify seed script produces expected state idempotently

---

## AGENT 2 — ODOO INTEGRATION

### Environment
- [ ] **ODOO-ENV-01 — Verify Odoo Version**: Validate target Odoo instance (v17/v18) and edition (Community/Enterprise)
- [ ] **ODOO-ENV-02 — Verify Odoo Service**: Ensure Odoo service is active, reachable over HTTP/JSON-RPC
- [ ] **ODOO-ENV-03 — Verify RPC Access**: Verify XML-RPC / JSON-RPC endpoints (`/xmlrpc/2/common`, `/xmlrpc/2/object`) respond
- [ ] **ODOO-ENV-04 — Verify Integration User**: Provision dedicated `dealflow_integration` user with appropriate access rights
- [ ] **ODOO-ENV-05 — Verify Required Odoo Modules**: Confirm `sale_management`, `stock`, `account` are installed

### Client
- [ ] **ODOO-CLI-01 — RPC Client Scaffold**
  - Owner: Agent 2 (Odoo Integration)
  - Priority: P0
  - Dependency: ODOO-ENV-03
  - Acceptance: Python client wrapping Odoo XML-RPC / JSON-RPC with typed connection parameters
  - Verification: Connection probe script executes without errors
- [ ] **ODOO-CLI-02 — Authentication & Session Management**
  - Owner: Agent 2 (Odoo Integration)
  - Priority: P0
  - Dependency: ODOO-CLI-01
  - Acceptance: Client authenticates with UID resolution and persistent session caching
  - Verification: Successfully retrieve `uid` for configured credentials
- [ ] **ODOO-CLI-03 — Error Handling & Retry Policies**
  - Owner: Agent 2 (Odoo Integration)
  - Priority: P1
  - Dependency: ODOO-CLI-01
  - Acceptance: Graceful handling of network timeouts, Odoo faults, and access denied errors
  - Verification: Simulated network drop raises clear domain exception, not uncaught stack trace
- [ ] **ODOO-CLI-04 — Connection Smoke Testing**
  - Owner: Agent 2 (Odoo Integration)
  - Priority: P0
  - Dependency: ODOO-CLI-02
  - Acceptance: Standalone test verifying live Odoo connection and read access
  - Verification: `python -m pytest backend/tests/test_odoo_client.py` passes

### Context
- [ ] **ODOO-CTX-01 — Customer Extraction**: Fetch partner details (`res.partner`), tier tags, and payment terms
- [ ] **ODOO-CTX-02 — Product Master Extraction**: Fetch products (`product.product`), standard cost, list price, category
- [ ] **ODOO-CTX-03 — Sales Order Extraction**: Fetch quote header (`sale.order`), state, date, customer reference
- [ ] **ODOO-CTX-04 — Sales Order Line Extraction**: Fetch line items (`sale.order.line`), quantities, unit prices, discounts
- [ ] **ODOO-CTX-05 — Pricing & Discount Extraction**: Extract line discount percentages and compute net totals
- [ ] **ODOO-CTX-06 — Margin & Cost Extraction**: Compute line-level and order-level gross margins from standard costs
- [ ] **ODOO-CTX-07 — Warehouse Stock Extraction**: Query `stock.quant` across warehouses for ordered products
- [ ] **ODOO-CTX-08 — Normalized DealContext Adapter**
  - Owner: Agent 2 (Odoo Integration)
  - Priority: P0
  - Dependency: ODOO-CTX-01 to ODOO-CTX-07
  - Acceptance: Assemble complete, valid `DealContext` adhering strictly to Agent 3's Pydantic contract
  - Verification: Validate assembled dictionary against `DealContext.model_validate()`

### Odoo Module
- [ ] **ODOO-MOD-01 — Custom Addon Scaffold**: Create `dealflow_governance` addon directory with `__manifest__.py`
- [ ] **ODOO-MOD-02 — sale.order Field Extensions**: Add `dealflow_state`, `dealflow_risk_score`, `dealflow_nba` fields
- [ ] **ODOO-MOD-03 — Status & Action Views**: Render DealFlow status badges and "Submit for Governance" button on quotation view
- [ ] **ODOO-MOD-04 — Risk Display Integration**: Embed color-coded risk indicators inside Odoo Sales Order form
- [ ] **ODOO-MOD-05 — Security & Access Controls**: Define `ir.model.access.csv` granting Sales Reps read and Managers approval rights
- [ ] **ODOO-MOD-06 — Portal Quotation Hook**: Hook into Odoo customer portal quote view to redirect counteroffers to DealFlow

### Transaction Execution
- [ ] **ODOO-TX-01 — Order Confirmation**
  - Owner: Agent 2 (Odoo Integration)
  - Priority: P0
  - Dependency: ODOO-CLI-02
  - Acceptance: Call `action_confirm` on `sale.order` only upon verified `APPROVED` governance status
  - Verification: Order moves from `draft`/`sent` to `sale` in Odoo
- [ ] **ODOO-TX-02 — Delivery Picking Generation**: Verify `stock.picking` records generate upon order confirmation
- [ ] **ODOO-TX-03 — Inventory Reservation**: Validate stock reservations match allocated warehouse quantities
- [ ] **ODOO-TX-04 — Multi-Warehouse Fulfillment Execution**: Update order line procurement routes to match DealFlow fulfillment split
- [ ] **ODOO-TX-05 — Subscription Integration**: Trigger recurring subscription creation if order contains subscription products
- [ ] **ODOO-TX-06 — Invoice Verification**: Trigger `_create_invoices()` and verify invoice lines reflect final negotiated prices
- [ ] **ODOO-TX-07 — Payment State Tracking**: Read invoice payment status (`not_paid`, `in_payment`, `paid`) for deal closure

### Testing
- [ ] **ODOO-TST-01 — RPC Connection Tests**: Test authentication and connection resiliency
- [ ] **ODOO-TST-02 — Deal Context Extraction Tests**: Compare Odoo raw records against normalized `DealContext`
- [ ] **ODOO-TST-03 — Order Confirmation Tests**: Confirm order state moves to `sale` via API
- [ ] **ODOO-TST-04 — Inventory Reservation Tests**: Verify picking stock matches expected warehouses
- [ ] **ODOO-TST-05 — Billing & Invoicing Tests**: Confirm invoice amounts match approved deal total
- [ ] **ODOO-TST-06 — Odoo ACL & Security Tests**: Verify unauthorized users cannot bypass confirmation rules

---

## AGENT 3 — DEAL GOVERNANCE

### Foundation
- [ ] **GOV-FND-01 — Domain Models Freeze**
  - Owner: Agent 3 (Deal Governance)
  - Priority: P0
  - Dependency: None
  - Acceptance: Immutable Pydantic models for `DealContext`, `QuoteLine`, `WarehouseStock`, `PolicyRule`
  - Verification: Pydantic schemas validate with zero errors under strict mode
- [ ] **GOV-FND-02 — Governance Repository Interfaces**
  - Owner: Agent 3 (Deal Governance)
  - Priority: P0
  - Dependency: GOV-FND-01
  - Acceptance: Python `Protocol` interfaces for `DealRepositoryProtocol`, `PolicyRepositoryProtocol`, `AuditRepositoryProtocol`
  - Verification: Static type checking cleanly passes
- [ ] **GOV-FND-03 — DealContext Assembly & Normalization**
  - Owner: Agent 3 (Deal Governance)
  - Priority: P0
  - Dependency: GOV-FND-01
  - Acceptance: Helper to validate and normalize raw dictionaries into typed `DealContext`
  - Verification: Test with valid and invalid payloads
- [ ] **GOV-FND-04 — Event System Definitions**
  - Owner: Agent 3 (Deal Governance)
  - Priority: P0
  - Dependency: GOV-FND-01
  - Acceptance: Event types: `DealUpdatedEvent`, `ApprovalSubmittedEvent`, `ApprovalDecisionEvent`, `CustomerNegotiatedEvent`
  - Verification: Event serialization and deserialization tests pass
- [ ] **GOV-FND-05 — Mock Context Fixtures**
  - Owner: Agent 3 (Deal Governance)
  - Priority: P0
  - Dependency: GOV-FND-01
  - Acceptance: Comprehensive fixtures for Acme Corp golden demo, boundary cases, and multi-line quotes
  - Verification: `fixtures/deal_contexts.py` importable across backend tests

### GOV-01 Policy
- [ ] **GOV-POL-01 — Customer Tier Policy Resolution**: Lookup maximum allowed discount by customer tier (Platinum, Gold, Standard)
- [ ] **GOV-POL-02 — Category Policy Resolution**: Lookup category discount ceiling (Hardware, Software, Services)
- [ ] **GOV-POL-03 — Effective Ceiling Computation**: Enforce strict minimum rule: `ceiling = min(tier_limit, category_limit)`
- [ ] **GOV-POL-04 — Policy Precedence Enforcement**: Resolve specific category rules before fallback general rules
- [ ] **GOV-POL-05 — Reason Code Generation**: Produce explainable reason codes (e.g., `EXCEEDS_CATEGORY_CEILING`, `WITHIN_POLICY`)
- [ ] **GOV-POL-06 — Boundary & Edge Tests**: Test exactly on ceiling, 0.01% above ceiling, 0% discount, 100% discount

### GOV-02 Risk
- [ ] **GOV-RSK-01 — Discount Excess Factor**: Calculate risk contribution based on percentage discount exceeds effective ceiling
- [ ] **GOV-RSK-02 — Margin Exposure Factor**: Calculate risk contribution from low or negative gross margin percentages
- [ ] **GOV-RSK-03 — Fulfillment Risk Factor**: Compute risk score based on multi-warehouse split penalty or backorder presence
- [ ] **GOV-RSK-04 — Deal Delay Risk Factor**: Add risk penalty for stalled quotes exceeding inactivity threshold
- [ ] **GOV-RSK-05 — Score Bounds Enforcement**: Bound blended score strictly between 0 and 100
- [ ] **GOV-RSK-06 — Severity Level Mapping**: Map score to severity: `LOW` (0–29), `MEDIUM` (30–59), `HIGH` (60–79), `CRITICAL` (80–100)
- [ ] **GOV-RSK-07 — Explainability Synthesis**: Generate human-readable explanation with exact numeric factor contributions
- [ ] **GOV-RSK-08 — Determinism & Mathematical Tests**: Verify same inputs produce identical 64-bit float/integer scores across 100 runs

### GOV-03 Approval
- [ ] **GOV-APP-01 — Approval State Machine Definition**: Define enum states: `DRAFT`, `AUTO_APPROVED`, `PENDING_MANAGER`, `PENDING_FINANCE`, `APPROVED`, `REJECTED`, `INVALIDATED`
- [ ] **GOV-APP-02 — Legal Transition Matrix**: Implement strict transition table rejecting invalid jumps (e.g., `DRAFT` → `APPROVED`)
- [ ] **GOV-APP-03 — Multi-Tier Approval Routing**: Route `LOW` risk to auto-approve, `MEDIUM` to Manager, `HIGH`/`CRITICAL` to Finance
- [ ] **GOV-APP-04 — Manager Approval Handler**: Transition `PENDING_MANAGER` to `APPROVED` or advance to `PENDING_FINANCE`
- [ ] **GOV-APP-05 — Finance Approval Handler**: Transition `PENDING_FINANCE` to `APPROVED` upon executive action
- [ ] **GOV-APP-06 — Rejection & Revision Handler**: Transition to `REJECTED` with required reason notes
- [ ] **GOV-APP-07 — Illegal Transition Rejection Tests**: Verify unauthorized or invalid state transitions raise `IllegalTransitionError`

### GOV-04 Invalidation
- [ ] **GOV-INV-01 — Approved Baseline Storage**: Store frozen snapshot of approved lines, prices, discounts, and margins
- [ ] **GOV-INV-02 — Immutable Baseline Verification**: Ensure approved baseline cannot be modified once set
- [ ] **GOV-INV-03 — Material Change Detection Engine**: Compare incoming quote state against stored baseline
- [ ] **GOV-INV-04 — Discount Increase Detection**: Flag any line item where `new_discount > baseline_discount`
- [ ] **GOV-INV-05 — Margin Deterioration Detection**: Flag quote where overall gross margin drops by > 0.5%
- [ ] **GOV-INV-06 — Commercial Change Detection**: Flag quantity reductions on high-margin lines or payment term extensions
- [ ] **GOV-INV-07 — Harmless Change Filtering**: Ignore non-commercial changes (notes, shipping address corrections)
- [ ] **GOV-INV-08 — Approval Invalidation Trigger**: Transition state from `APPROVED` to `INVALIDATED` upon material breach
- [ ] **GOV-INV-09 — Re-Approval Routing Trigger**: Automatically route invalidated deal to `PENDING_MANAGER` or `PENDING_FINANCE`
- [ ] **GOV-INV-10 — Invalidation Audit Logging**: Emit structured audit record detailing exact baseline vs proposed delta

### Negotiation
- [ ] **GOV-NEG-01 — Customer Proposal Data Model**: Structured schema for incoming customer counteroffers
- [ ] **GOV-NEG-02 — Proposal Input Validation**: Validate proposed discounts, quantities, and customer commentary
- [ ] **GOV-NEG-03 — Negotiation Evaluation**: Evaluate proposed terms against policy ceilings and current approved baseline
- [ ] **GOV-NEG-04 — Structured Change Records**: Generate itemized list of changes (line, old value, proposed value, impact)
- [ ] **GOV-NEG-05 — Re-Evaluation Trigger**: Pipe accepted proposals directly into Deal Guardian invalidation pipeline
- [ ] **GOV-NEG-06 — Duplicate Proposal Handling**: Reject duplicate proposals submitted while negotiation is under active review

### GOV-06 Recommendation
- [ ] **GOV-REC-01 — Candidate Product Filtering**: Filter catalog candidates to avoid recommending already-quoted items
- [ ] **GOV-REC-02 — Co-Purchase Frequency Scoring**: Score candidates based on historical affinity with current quote lines
- [ ] **GOV-REC-03 — Margin Accretion Scoring**: Rank products with gross margin percentage higher than deal average
- [ ] **GOV-REC-04 — Promotional Priority Scoring**: Apply weighting to active marketing/strategic promotion products
- [ ] **GOV-REC-05 — Deterministic Formula Ranking**: Compute `score = (0.5 * co_purchase) + (0.3 * margin) + (0.2 * promo)`
- [ ] **GOV-REC-06 — Duplicate & Existing Line Filtering**: Ensure no duplicate recommendations returned
- [ ] **GOV-REC-07 — Negative Margin Elimination**: Hard filter excluding any product with negative projected margin
- [ ] **GOV-REC-08 — Recommendation Explanation**: Generate plain-English justification for why each product is suggested

### GOV-07 Fulfillment
- [ ] **GOV-FUL-01 — Primary Warehouse Allocation**: Greedily satisfy line quantity from primary facility first
- [ ] **GOV-FUL-02 — Secondary Warehouse Allocation**: Allocate remaining shortfall from secondary facility
- [ ] **GOV-FUL-03 — Backorder Calculation**: Calculate unfulfilled balance as backorder if total stock < requested qty
- [ ] **GOV-FUL-04 — Stock Bound Invariant**: Assert allocated quantities never exceed available warehouse stock
- [ ] **GOV-FUL-05 — Duplicate Warehouse Consolidation**: Consolidate multiple quants for same warehouse into single line
- [ ] **GOV-FUL-06 — Conservation of Quantity Invariant**: Verify `sum(allocated) + backorder == requested_qty` for all lines
- [ ] **GOV-FUL-07 — Fulfillment Plan Explanation**: Generate summary of facilities, split count, and estimated delivery lag

### GOV-08 Health
- [ ] **GOV-HLT-01 — Stalled Deal Detection**: Flag deals with no activity for > 5 business days
- [ ] **GOV-HLT-02 — Discount Anomaly Detection**: Flag discounts exceeding 2 standard deviations above sales rep mean
- [ ] **GOV-HLT-03 — Health Score Calculation**: Compute composite health score from 0 (Critical) to 100 (Flawless)
- [ ] **GOV-HLT-04 — Health Status Categorization**: Categorize into `HEALTHY`, `AT_RISK`, or `CRITICAL`
- [ ] **GOV-HLT-05 — Typed Health Flags**: Produce structured flags: `STALLED_IN_APPROVAL`, `MARGIN_COMPROMISED`, `STOCK_BOTTLENECK`
- [ ] **GOV-HLT-06 — Health Evaluation Tests**: Verify health triggers accurately on synthetic stalled and anomalous deals

### Next Best Action
- [ ] **GOV-NBA-01 — Approval Required Action**: Recommend `MANAGER_APPROVAL_REQUIRED` or `FINANCE_APPROVAL_REQUIRED`
- [ ] **GOV-NBA-02 — Re-Approval Action**: Recommend `RE_APPROVAL_REQUIRED` when deal has been invalidated
- [ ] **GOV-NBA-03 — Fulfillment Split Action**: Recommend `ACCEPT_WAREHOUSE_SPLIT` when multi-facility routing needed
- [ ] **GOV-NBA-04 — Negotiation Action**: Recommend `REVIEW_CUSTOMER_COUNTEROFFER` when new proposal arrives
- [ ] **GOV-NBA-05 — Confirmation Action**: Recommend `CONFIRM_QUOTATION_IN_ODOO` when deal is fully approved
- [ ] **GOV-NBA-06 — Stalled Follow-Up Action**: Recommend `FOLLOW_UP_WITH_CUSTOMER` when deal is healthy but stalled
- [ ] **GOV-NBA-07 — Deterministic Priority Hierarchy**: Resolve multiple competing actions into single top priority

### Guardian
- [ ] **GOV-GRD-01 — End-to-End Orchestration**: Chain Policy → Risk → Approval → Rec → Fulfillment → Health → NBA in < 5ms
- [ ] **GOV-GRD-02 — Policy → Risk Integration**: Pass effective ceiling excess cleanly into risk factor generator
- [ ] **GOV-GRD-03 — Risk → Approval Integration**: Route deal to appropriate FSM stage based on blended score and excess
- [ ] **GOV-GRD-04 — Approval → Recommendation Integration**: Generate recommendations to offset concession if risk is high
- [ ] **GOV-GRD-05 — Fulfillment Engine Integration**: Attach greedy fulfillment plan to decision snapshot
- [ ] **GOV-GRD-06 — Health Engine Integration**: Attach health flags and anomaly detection to decision snapshot
- [ ] **GOV-GRD-07 — Next Best Action Integration**: Resolve and attach top operational action to snapshot
- [ ] **GOV-GRD-08 — Final Decision Snapshot Synthesis**: Build immutable `GuardianEvaluationResult` containing all results
- [ ] **GOV-GRD-09 — Persistence Interface Integration**: Invoke repository save callbacks if session provided
- [ ] **GOV-GRD-10 — Event Handler Integration**: React deterministically to incoming governance events

### Event System
- [ ] **GOV-EVT-01 — Deal Updated Event Handler**: Trigger re-evaluation on quote modification
- [ ] **GOV-EVT-02 — Approval Submitted Event Handler**: Validate deal is in submit-eligible state and route
- [ ] **GOV-EVT-03 — Approval Approved Event Handler**: Record approval, save baseline, check if further tiers required
- [ ] **GOV-EVT-04 — Approval Rejected Event Handler**: Record rejection and transition to `REJECTED`
- [ ] **GOV-EVT-05 — Customer Negotiated Event Handler**: Process counteroffer, detect material change, invalidate if needed
- [ ] **GOV-EVT-06 — Fulfillment Changed Event Handler**: Recalculate fulfillment risk and update plan
- [ ] **GOV-EVT-07 — Event Idempotency**: Deduplicate events by `event_id` to prevent double evaluation or duplicate audit rows
- [ ] **GOV-EVT-08 — Duplicate Event Resiliency Tests**: Verify re-sending identical event yields cached or identical result

### Hardening
- [ ] **GOV-HRD-01 — Strict Input Validation**: Handle missing lines, zero values, extreme values without uncaught crashes
- [ ] **GOV-HRD-02 — Edge-Case Hardening**: Handle all-zero stock, 100% discount, zero price items gracefully
- [ ] **GOV-HRD-03 — Mathematical Invariant Tests**: Run test suite verifying conservation of quantity and bounded risk scores
- [ ] **GOV-HRD-04 — Full Determinism Tests**: 1000-iteration test confirming zero drift in risk, approval, or fulfillment
- [ ] **GOV-HRD-05 — Performance Benchmarks**: Confirm complete Guardian evaluation pipeline finishes in < 10 milliseconds
- [ ] **GOV-HRD-06 — Killer Demo Golden Path Test**: Standalone test simulating 18% approval → 22% counteroffer → invalidation

---

## AGENT 4 — FRONTEND / UX

### Foundation
- [ ] **UI-FND-01 — Web App Project Setup**
  - Owner: Agent 4 (Frontend / UX)
  - Priority: P0
  - Dependency: None
  - Acceptance: React + TypeScript + Vite/Next.js scaffolded with clean layout structure
  - Verification: `npm run dev` launches application without errors
- [ ] **UI-FND-02 — Routing & Navigation Structure**
  - Owner: Agent 4 (Frontend / UX)
  - Priority: P0
  - Dependency: UI-FND-01
  - Acceptance: Client-side routing for Workspace, Control Tower, and Customer Portal
  - Verification: Direct navigation to `/workspace`, `/control-tower`, and `/portal` succeeds
- [ ] **UI-FND-03 — Modern Design System & Theme**
  - Owner: Agent 4 (Frontend / UX)
  - Priority: P1
  - Dependency: UI-FND-01
  - Acceptance: Professional typography (Inter), cohesive dark/light palette, status color tokens
  - Verification: Visual review of base components
- [ ] **UI-FND-04 — API Client & Error Boundary**
  - Owner: Agent 4 (Frontend / UX)
  - Priority: P0
  - Dependency: UI-FND-01
  - Acceptance: Fetch/Axios client pointing to FastAPI endpoints with error interceptors
  - Verification: Mock API response renders correctly; error triggers banner
- [ ] **UI-FND-05 — Role Switching Navigation Bar**
  - Owner: Agent 4 (Frontend / UX)
  - Priority: P0
  - Dependency: UI-FND-02
  - Acceptance: Quick toggle between Sales Rep, Manager, and Customer views for hackathon demo
  - Verification: Switching role updates view and available capabilities immediately

### Sales Rep
- [ ] **UI-REP-01 — Quotation Workspace**: Clean builder showing deal header, customer summary, and commercial metrics
- [ ] **UI-REP-02 — Customer Context Header**: Displays customer name, Gold tier badge, payment terms, and historical spend
- [ ] **UI-REP-03 — Line Item Editor**: Add/remove products with live quantity, unit price, and subtotal calculation
- [ ] **UI-REP-04 — Discount Slider & Inputs**: Line-level discount input with instant feedback on effective ceiling
- [ ] **UI-REP-05 — Real-Time Margin Display**: Order-level and line-level gross margin summary with color-coded warnings
- [ ] **UI-REP-06 — Deal Guardian Visual Card**: Dedicated widget showing current evaluation status and approval requirements
- [ ] **UI-REP-07 — Risk Gauge Component**: Visual radial or progress gauge displaying 0–100 score and `LOW`/`MED`/`HIGH` badge
- [ ] **UI-REP-08 — Risk Factor Breakdown**: Expandable drawer explaining exact numeric contributions to the risk score
- [ ] **UI-REP-09 — Upsell Recommendation Carousel**: Display accretive products with "+₹ Margin" badge and 1-click "Add to Quote"
- [ ] **UI-REP-10 — Next Best Action Banner**: High-visibility banner highlighting the single priority action for the rep
- [ ] **UI-REP-11 — Fulfillment Status Summary**: Widget displaying multi-facility stock availability and backorder alerts

### Manager / Finance
- [ ] **UI-MGR-01 — Control Tower Dashboard**: Executive overview of pipeline risk, approval velocity, and margin exposure
- [ ] **UI-MGR-02 — Executive KPI Cards**: Total value under governance, high-risk quotes count, pending approvals, avg margin
- [ ] **UI-MGR-03 — Approval Queue Table**: Filterable queue of deals waiting for Manager or Finance sign-off
- [ ] **UI-MGR-04 — Risk Details Drawer**: Full inspection modal showing deal context, policy breach, and factor breakdown
- [ ] **UI-MGR-05 — Material Change Diff Viewer**: Visual side-by-side diff comparing Approved Baseline vs Current Proposal
- [ ] **UI-MGR-06 — One-Click Approval Actions**: "Approve Concession", "Reject with Reason", "Return for Revision" buttons
- [ ] **UI-MGR-07 — Deal Health & Anomaly Indicators**: Badges highlighting stalled quotes (>5d) and discount outliers (>2σ)
- [ ] **UI-MGR-08 — Immutable Audit Timeline**: Chronological event stream showing creation, evaluations, approvals, and invalidations

### Customer
- [ ] **UI-CUST-01 — Restricted Customer Portal**: Clean, branded quote view accessible via external link or role switcher
- [ ] **UI-CUST-02 — Clean Quotation Display**: Display itemized products, quantities, prices, and total without internal costs
- [ ] **UI-CUST-03 — Counteroffer Negotiation Interface**: Inline edit allowing customer to request alternative discount or qty
- [ ] **UI-CUST-04 — Customer Commentary Box**: Text area for customer to state business justification for counteroffer
- [ ] **UI-CUST-05 — Submit Negotiation Action**: Submits counteroffer proposal to Deal Guardian evaluation endpoint
- [ ] **UI-CUST-06 — Quote Acceptance & Sign-Off**: "Accept & Confirm Order" button for when terms are agreeable
- [ ] **UI-CUST-07 — Strict Zero-Information Leakage**: Rigorous audit confirming internal margin % and costs are completely absent
- [ ] **UI-CUST-08 — Risk Information Isolation**: Rigorous audit confirming Guardian risk scores and rules are completely absent

### Fulfillment
- [ ] **UI-FUL-01 — Multi-Warehouse Visual Map**: Visual representation of Main Warehouse vs Regional Depots
- [ ] **UI-FUL-02 — Proposed Split Table**: Clear breakdown showing line items allocated per warehouse
- [ ] **UI-FUL-03 — Backorder Warning View**: Distinct amber alert showing quantities requiring delayed fulfillment
- [ ] **UI-FUL-04 — Accept Split Action**: Button allowing rep/manager to accept and lock the proposed fulfillment plan

### UX Quality
- [ ] **UI-UX-01 — Skeleton Loading States**: Smooth shimmer effects while awaiting Guardian or Odoo API responses
- [ ] **UI-UX-02 — Error State Handling**: Clear, friendly error banners with retry buttons on network or validation failures
- [ ] **UI-UX-03 — Empty States**: Informative placeholders for empty approval queues and empty deal lists
- [ ] **UI-UX-04 — Responsive Layout**: Usable across desktop and tablet screen resolutions
- [ ] **UI-UX-05 — Role-Based Component Guarding**: Automatically disable or hide actions outside the active persona
- [ ] **UI-UX-06 — Golden Demo Visual Polish**: Refined transitions, micro-interactions, and toast alerts for hackathon presentation

---

## CROSS-AGENT INTEGRATION CHECKLIST

- [ ] **INT-01 — Freeze DealContext Schema Contract**
  - Participants: Agent 2, Agent 3, Agent 4
  - Dependency: GOV-FND-01, ODOO-CTX-08
  - Acceptance: JSON schema matching `DealContext` signed off by all agents
  - Verification: Schema validation passes with sample Odoo and mock data
- [ ] **INT-02 — Freeze GuardianEvaluationResult Contract**
  - Participants: Agent 3, Agent 4
  - Dependency: GOV-GRD-08, UI-FND-04
  - Acceptance: API response schema signed off by Governance and Frontend
  - Verification: Frontend TypeScript types compile against Pydantic OpenAPI spec
- [ ] **INT-03 — Freeze Customer Portal DTO**
  - Participants: Agent 3, Agent 4
  - Dependency: GOV-NEG-01, UI-CUST-01
  - Acceptance: Sanitized payload contract excluding all cost/risk data signed off
  - Verification: Automated test asserting zero prohibited fields present in DTO
- [ ] **INT-04 — Freeze Audit Event Schema Contract**
  - Participants: Agent 1, Agent 3
  - Dependency: DB-ENT-13, GOV-FND-04
  - Acceptance: JSON payload schema for `audit_event` signed off
  - Verification: Event payload serializes into database without truncation
- [ ] **INT-05 — Connect Database Repositories to API**
  - Participants: Agent 1, Agent 3
  - Dependency: DB-REP-01 to DB-REP-09, GOV-GRD-09
  - Acceptance: Guardian endpoints persist and read decisions using Agent 1's repositories
  - Verification: End-to-end test reading and writing from PostgreSQL
- [ ] **INT-06 — Connect Odoo DealContext Provider**
  - Participants: Agent 2, Agent 3
  - Dependency: ODOO-CTX-08, GOV-FND-03
  - Acceptance: DealFlow API endpoint builds `DealContext` directly from live Odoo quotation
  - Verification: `GET /api/deals/{id}/context` returns populated context from Odoo
- [ ] **INT-07 — Connect Guardian to FastAPI Gateway**
  - Participants: Agent 3
  - Dependency: GOV-GRD-01
  - Acceptance: REST routes `/api/governance/evaluate`, `/api/governance/approve`, `/api/governance/negotiate`
  - Verification: Automated route integration tests pass
- [ ] **INT-08 — Connect Frontend to Guardian API**
  - Participants: Agent 4, Agent 3
  - Dependency: UI-REP-01, INT-07
  - Acceptance: Sales Rep workspace triggers live evaluation upon changing line item discount
  - Verification: Risk gauge updates in UI in real-time
- [ ] **INT-09 — Connect Negotiation to Invalidation Engine**
  - Participants: Agent 3, Agent 4
  - Dependency: UI-CUST-05, GOV-INV-08
  - Acceptance: Customer portal counteroffer automatically invalidates previous approved baseline
  - Verification: Manager Control Tower immediately updates deal state to `INVALIDATED`
- [ ] **INT-10 — Connect Fulfillment Plan to Odoo**
  - Participants: Agent 2, Agent 3
  - Dependency: GOV-FUL-01, ODOO-TX-04
  - Acceptance: Approved fulfillment split updates procurement routes and stock pickings in Odoo
  - Verification: Delivery orders in Odoo reflect correct split warehouses
- [ ] **INT-11 — Connect Approval State to Frontend UI**
  - Participants: Agent 4, Agent 3
  - Dependency: UI-MGR-06, GOV-APP-04
  - Acceptance: Manager approving quote immediately changes rep workspace status to `APPROVED`
  - Verification: Live UI test with two browser sessions
- [ ] **INT-12 — Verify Audit Trail Persistence**
  - Participants: Agent 1, Agent 3, Agent 4
  - Dependency: DB-REP-09, GOV-EVT-01 to GOV-EVT-06, UI-MGR-08
  - Acceptance: Every evaluation, approval, counteroffer, and invalidation appears in audit timeline
  - Verification: Inspect audit timeline modal for complete event history
- [ ] **INT-13 — Verify End-to-End State Consistency**
  - Participants: All Agents
  - Dependency: All components
  - Acceptance: Zero discrepancies between Odoo `sale.order`, DealFlow DB, and Frontend UI
  - Verification: Cross-system data integrity test script passes

---

## GOLDEN DEMO CHECKLIST

- [ ] **DEMO-01 — Sales Rep Opens Demo Quotation**: Rep logs into Quotation Workspace and opens draft for Acme Corp
- [ ] **DEMO-02 — Add Laptop Hardware Lines**: Rep adds 10 Enterprise Laptops at ₹1,20,000 each with 12% discount
- [ ] **DEMO-03 — Add Service Line**: Rep adds Cloud Architecture Setup Service at ₹80,000 list price
- [ ] **DEMO-04 — Apply 18% Service Discount**: Rep increases Service discount to 18% (violating 10% ceiling)
- [ ] **DEMO-05 — Guardian Detects Policy Violation**: Deal Guardian flags 8% category violation in real-time
- [ ] **DEMO-06 — Risk Score Becomes HIGH**: Blended risk gauge jumps to 61/100 (`HIGH`)
- [ ] **DEMO-07 — Approval Requirement Appears**: State moves to `PENDING_FINANCE`; NBA highlights "Finance Approval Required"
- [ ] **DEMO-08 — Accretive Recommendation Appears**: Carousel suggests Thunderbolt Docking Station (+₹13,000 margin)
- [ ] **DEMO-09 — Recommendation Applied**: Rep clicks "Add to Quote"; gross margin recovers by +1.4%
- [ ] **DEMO-10 — Manager / Finance Reviews**: Finance Officer switches to Control Tower and inspects risk breakdown
- [ ] **DEMO-11 — Strategic Deal Approved**: Finance Officer clicks "Approve Strategic Concession"; status updates to `APPROVED`
- [ ] **DEMO-12 — Approved Baseline Stored**: Deal Guardian captures immutable snapshot with 18% service discount
- [ ] **DEMO-13 — Fulfillment Split Displayed**: UI shows 9 laptops from Main Warehouse, 1 laptop from East Depot
- [ ] **DEMO-14 — Customer Opens Portal**: Switch to external customer view; clean quotation displayed without costs
- [ ] **DEMO-15 — Customer Requests 22% Service Discount**: Customer submits counteroffer asking for 22% discount
- [ ] **DEMO-16 — Material Change Detected**: Material change detector flags 22% > 18% baseline
- [ ] **DEMO-17 — Previous Approval Invalidated**: Deal Guardian automatically revokes status to `INVALIDATED`
- [ ] **DEMO-18 — Risk Recalculated**: Blended risk recalculates to 68/100
- [ ] **DEMO-19 — Re-Approval Required**: Deal reset to `PENDING_FINANCE`; NBA updates to "Executive Re-Approval Required"
- [ ] **DEMO-20 — Final Approval Granted**: Executive reviews diff viewer and grants final concession
- [ ] **DEMO-21 — Odoo Sale Order Confirmed**: Deal status triggers Odoo RPC `action_confirm`; order moves to `sale`
- [ ] **DEMO-22 — Delivery / Picking Visible**: Odoo delivery orders show reserved stock across both warehouses
- [ ] **DEMO-23 — Invoice / Billing State Visible**: Customer invoice generated reflecting exact negotiated prices
- [ ] **DEMO-24 — Audit Trail Visible**: Full chronological timeline of approvals, invalidation, and confirmation reviewed

---

## 24-HOUR EXECUTION CHECKLIST

### Hour 0–1: Kickoff & Alignment
- [ ] **H0-01 — Freeze All Shared Interface Contracts**: Lock `DealContext`, `GuardianResult`, and API DTOs
- [ ] **H0-02 — Verify Environments & Services**: Confirm PostgreSQL, Odoo, Python, and Node environments operational
- [ ] **H0-03 — Launch Parallel Workstreams**: All 4 agents begin work inside isolated module boundaries

### Hour 1–4: Foundations
- [ ] **H1-01 — Database Tables & Migrations**: Agent 1 runs initial migration on PostgreSQL
- [ ] **H1-02 — Odoo RPC Client Working**: Agent 2 authenticates and queries test partner
- [ ] **H1-03 — Governance Core Engine Functional**: Agent 3 executes Policy and Risk algorithms offline
- [ ] **H1-04 — Frontend Shell Scaffolded**: Agent 4 establishes navigation and base UI layout

### Hour 4–8: Core Logic & Bridge
- [ ] **H4-01 — Database Repositories Implemented**: Agent 1 completes Deal and Policy repositories
- [ ] **H4-02 — Odoo Context Adapter Complete**: Agent 2 extracts complete `DealContext` from Odoo
- [ ] **H4-03 — Approval FSM & Recommendations**: Agent 3 implements state transitions and upsell scoring
- [ ] **H4-04 — Sales Rep Quotation Workspace**: Agent 4 renders line items, discount inputs, and margin metrics

### Hour 8–12: Governance & Portals
- [ ] **H8-01 — Invalidation Engine & NBA Complete**: Agent 3 completes baseline storage and invalidation
- [ ] **H8-02 — Manager Control Tower & Approval Queue**: Agent 4 builds executive dashboard and diff viewer
- [ ] **H8-03 — Customer Negotiation Portal**: Agent 4 builds customer view with zero internal data leakage
- [ ] **H8-04 — Database Seed Data Loaded**: Agent 1 loads demo policies, tier ceilings, and Acme Corp data

### Hour 12–16: First Live Integration
- [ ] **H12-01 — Connect Frontend to FastAPI Gateway**: UI triggers live Guardian evaluation
- [ ] **H12-02 — Connect Guardian to PostgreSQL**: Guardian reads policies and persists decisions via repositories
- [ ] **H12-03 — Connect Guardian to Odoo Context**: Real Odoo orders populate Quotation Workspace
- [ ] **H12-04 — Multi-Warehouse Fulfillment Flow**: Warehouse split visible in UI and mapped to Odoo routes

### Hour 16–20: End-to-End Golden Path
- [ ] **H16-01 — Verify Invalidation Flow End-to-End**: Test portal counteroffer revoking approval live
- [ ] **H16-02 — Verify Odoo Order Booking**: Test final approval confirming `sale.order` in Odoo
- [ ] **H16-03 — Audit Trail Live Inspection**: Verify complete lifecycle rendered on audit timeline
- [ ] **H16-04 — End-to-End Test Passes**: Complete automated regression script succeeds

### Hour 20–22: Polish & Rehearsals
- [ ] **H20-01 — Run 5-Minute Golden Demo Rehearsal #1**: Time presentation and test talking points
- [ ] **H20-02 — Test Demo Reset Script**: Run `reset_db.py` and verify pristine state in < 5 seconds
- [ ] **H20-03 — Verify Fallback Handling**: Ensure offline mock fallback ready if Odoo network hiccups
- [ ] **H20-04 — Visual Polish**: Fix contrast, font sizes, animations, and responsive quirks

### Hour 22–24: Code Freeze & Presentation
- [ ] **H22-01 — Absolute Code Freeze**: No non-essential code modifications permitted
- [ ] **H22-02 — Final Bug Fixes Only**: Only address critical blockers discovered during rehearsals
- [ ] **H22-03 — Run Final Full Rehearsal**: Rehearse live demonstration with full team
- [ ] **H22-04 — Presentation Deck & Demo Ready**: Slides finalized and live demo tabs prepped

---

## DEFINITION OF DONE

- [ ] **DOD-01 — All P0 Tasks Completed**: Every high-priority task across all 4 agents is satisfied
- [ ] **DOD-02 — All Four Workstreams Integrated**: Data flows seamlessly across Frontend, Gateway, Guardian, Odoo, and DB
- [ ] **DOD-03 — Deterministic & Explainable Rules**: Zero hallucinations; 100% reproducible risk and policy calculations
- [ ] **DOD-04 — Odoo Remains Transactional Source of Truth**: Master data and booking remain strictly inside Odoo
- [ ] **DOD-05 — Decision State Persisted Correctly**: All evaluations, baselines, and approvals safely stored in PostgreSQL
- [ ] **DOD-06 — Strict Customer Privacy Guaranteed**: Zero leakage of margins, costs, or risk scores in customer portal
- [ ] **DOD-07 — Invalidation Killer Scenario Functional**: 18% approval → 22% counteroffer → instant invalidation demonstrated
- [ ] **DOD-08 — Golden Demo Passes Unscripted**: 5-minute presentation path completes without manual intervention or crashes
- [ ] **DOD-09 — Zero Critical Errors or Uncaught Exceptions**: Application logs clean of unhandled exceptions
- [ ] **DOD-10 — Instant Demo Reset & Recovery**: One-line command restores clean demo state reliably
- [ ] **DOD-11 — Code Frozen & Clean Repository**: Repository contains only clean, documented, tested code
- [ ] **DOD-12 — Presentation & Video Demo Ready**: Pitch deck and backup screen recording ready for judges
