# DealFlow360 — Complete Database Management Architecture & Guide

> **Document Version:** 1.0.0  
> **Author:** Person 1 (DB Architect)  
> **Audience:** Engineering Team (Person 2: Odoo Integration, Person 3: Governance Engineer, Person 4: Frontend Engineer), Hackathon Evaluators  
> **Core Architecture:** Odoo as Transactional Truth | DealFlow as Decision State & Intelligence

---

## 1. Architectural Philosophy: The "Two Data Worlds"

DealFlow360 operates on a strict separation of concerns between ERP transaction execution and commercial decision governance:

```mermaid
flowchart TD
    subgraph World 1: Odoo ERP (Transactional Truth)
        O1[res.partner / CUSTOMER]
        O2[product.product / PRODUCT]
        O3[sale.order / SALES ORDER]
        O4[stock.warehouse & stock.quant / INVENTORY]
        O5[account.move & account.payment / BILLING]
    end

    subgraph World 2: DealFlow DB (Decision State & Memory)
        D1[deal / LIFECYCLE 1:1]
        D2[discount_policy / GOVERNANCE RULES]
        D3[risk_assessment & risk_factor / EXPLAINABILITY]
        D4[approval_request & approval_action / AUDIT LOG]
        D5[negotiation_request & negotiation_change / STAGED COUNTER-OFFERS]
        D6[fulfillment_plan & fulfillment_plan_line / WAREHOUSE OPTIMIZER]
        D7[deal_health_snapshot / ANOMALY TRACKING]
        D8[audit_event / SYSTEM MEMORY]
    end

    O3 <-->|1:1 via odoo_sale_order_id| D1
    O1 <-->|FK odoo_partner_id| D1
    O4 <-->|FK odoo_warehouse_id| D6
```

### The Separation Rules:
1. **Odoo (`WHAT HAPPENED`)**: Manages physical goods, stock levels, sales orders, ledger postings, payments, customer addresses, and user authentication.
2. **DealFlow (`WHY IT HAPPENED + WHAT SHOULD HAPPEN NEXT`)**: Evaluates policy compliance, computes explainable risk scores, manages multi-level approval state machines, stages portal counter-offers, optimizes multi-warehouse allocations, and records an append-only audit trail.
3. **Decoupled Lifecycle**: While an Odoo `sale.order` moves through linear stages (`draft` $\to$ `sent` $\to$ `sale`), a DealFlow `deal` can have multiple risk recalculations, negotiation cycles, approval invalidations, and fulfillment replanning events without mutating Odoo records prematurely.

---

## 2. Canonical Database Schema (13 Governance Entities)

All tables use standard PostgreSQL types. Primary keys in DealFlow use `UUID` (`uuid_generate_v4()`) to enable distributed generation and avoid sequence conflicts with Odoo's integer IDs.

```mermaid
erDiagram
    DEAL ||--o{ RISK_ASSESSMENT : "evaluated_by"
    RISK_ASSESSMENT ||--o{ RISK_FACTOR : "composed_of"
    RISK_ASSESSMENT ||--o{ APPROVAL_REQUEST : "triggers"
    APPROVAL_REQUEST ||--o{ APPROVAL_ACTION : "records"

    DEAL ||--o{ NEGOTIATION_REQUEST : "negotiates"
    NEGOTIATION_REQUEST ||--o{ NEGOTIATION_CHANGE : "stages_diffs"

    DEAL ||--o{ FULFILLMENT_PLAN : "plans"
    FULFILLMENT_PLAN ||--o{ FULFILLMENT_PLAN_LINE : "allocates"

    DEAL ||--o{ RECOMMENDATION : "suggests"
    DEAL ||--o{ DEAL_HEALTH_SNAPSHOT : "monitors"
    DEAL ||--o{ AUDIT_EVENT : "logs"

    DISCOUNT_POLICY ||--o{ DEAL : "governs"
```

### Table 1: `deal`
*Central state machine entity mapping 1:1 with Odoo `sale.order`.*
- **Columns:**
  - `id` (`UUID PK`): Primary key.
  - `odoo_sale_order_id` (`BIGINT UNIQUE NOT NULL`): Foreign key to Odoo `sale.order(id)`.
  - `odoo_partner_id` (`BIGINT NOT NULL`): Foreign key to Odoo `res.partner(id)`.
  - `owner_user_id` (`BIGINT NOT NULL`): Sales rep ID (`res.users(id)`).
  - `company_id` (`BIGINT NOT NULL DEFAULT 1`): Multi-company boundary.
  - `status` (`VARCHAR(32)`): `DRAFT`, `EVALUATED`, `PENDING_APPROVAL`, `APPROVED`, `NEGOTIATION`, `REAPPROVAL`, `READY`, `FULFILLING`, `BILLING`, `CLOSED`.
  - `approval_state` (`VARCHAR(32)`): `NONE`, `PENDING_MANAGER`, `PENDING_FINANCE`, `APPROVED`, `REJECTED`, `RETURNED`.
  - `health_status` (`VARCHAR(32)`): `HEALTHY`, `STALLED`, `AT_RISK`, `CRITICAL`.
  - `current_risk_score` (`DECIMAL(5,2)`): Cached latest score $[0.00, 100.00]$.
  - `created_at`, `updated_at` (`TIMESTAMPTZ`).

### Table 2: `discount_policy`
*Commercial governance rules defining discount ceilings, approval thresholds, and margin floors.*
- **Columns:**
  - `id` (`UUID PK`), `name` (`VARCHAR(128)`), `company_id` (`BIGINT`).
  - `customer_tier` (`VARCHAR(32)`): `BRONZE`, `SILVER`, `GOLD`, `ALL`.
  - `product_category_id` (`BIGINT NULLABLE`): References Odoo `product.category(id)`.
  - `max_discount_pct` (`DECIMAL(5,2)`): Discount ceiling before approval is required.
  - `manager_threshold` (`DECIMAL(5,2)`): Upper limit for Sales Manager approval.
  - `finance_threshold` (`DECIMAL(5,2)`): Upper limit for Finance approval.
  - `minimum_margin_pct` (`DECIMAL(5,2)`): Minimum allowable margin floor.
  - `priority` (`INT DEFAULT 10`): Precedence rank for policy resolution.
  - `active` (`BOOLEAN DEFAULT TRUE`), `effective_from`, `effective_to` (`DATE`).

### Tables 3 & 4: `risk_assessment` & `risk_factor`
*Itemized explainable risk model.*
- **`risk_assessment`**: Stores `deal_id`, `risk_score` ($0-100$), `severity` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `decision` (`AUTO_APPROVED`, `MANAGER_APPROVAL`, `FINANCE_APPROVAL`, `REJECTED`), `policy_version`, and `calculated_at`.
- **`risk_factor`**: Stores individual components (`factor_type`, `raw_value`, `weight`, `contribution`, `reason`, `source_reference`).
- *Why this design?* Instead of showing a black-box score like "61", the UI can render:
  - Line Discount Excess: `+36`
  - Margin Pressure: `+15`
  - Multi-Warehouse Stock Split: `+10`
  - **Total Risk: 61**

### Tables 5 & 6: `approval_request` & `approval_action`
*Multi-level approval workflow engine.*
- **`approval_request`**: Defines required level (`SALES_MANAGER`, `FINANCE`, `EXEC`), sequence number, and status (`PENDING`, `APPROVED`, `REJECTED`, `RETURNED`, `INVALIDATED`).
  - **Constraint:** Partial unique index `UNIQUE (deal_id, sequence) WHERE status = 'PENDING'` guarantees no duplicate active requests.
- **`approval_action`**: Non-overwriting audit log recording every reviewer action (`actor_user_id`, `action`, `reason`, `created_at`).

### Tables 7 & 8: `negotiation_request` & `negotiation_change`
*Customer portal negotiation isolation layer.*
- **Safety Valve Architecture**: External customer counter-offers are written to `negotiation_change` as field diffs (`odoo_sale_order_line_id`, `field_name`, `old_value`, `requested_value`).
- **Guarantee**: External portal actions **never directly mutate** Odoo `sale.order.line` records. Once submitted, DealFlow re-runs the risk engine. Only after approval are changes pushed to Odoo.

### Tables 9 & 10: `fulfillment_plan` & `fulfillment_plan_line`
*Warehouse split optimization and backorder tracking.*
- **`fulfillment_plan`**: Tracks `estimated_shipments`, `estimated_shipping_cost`, `algorithm_version`, and `status` (`PROPOSED`, `ACCEPTED`, `OVERRIDDEN`, `EXECUTED`).
- **`fulfillment_plan_line`**: Specific allocations per warehouse (`requested_qty`, `allocated_qty`, `backorder_qty`, `shipping_cost`).
- **Enforces Invariant 1**: `CHECK (allocated_qty + backorder_qty = requested_qty)`.

### Table 11: `recommendation`
*Upsell and cross-sell suggestions linked to products, expected margin delta, and status (`ACTIVE`, `ACCEPTED`, `DISMISSED`).*

### Table 12: `deal_health_snapshot`
*Point-in-time health metrics capturing `stalled_score`, `discount_anomaly_score`, `delivery_risk_score`, and `approval_delay_score`.*

### Table 13: `audit_event`
*Immutable, append-only system memory.*
- Captures `event_type`, `actor_type`, `actor_id`, `entity_type`, `entity_id`, `before_state` (`JSONB`), `after_state` (`JSONB`), `reason`, and `metadata` (`JSONB`).

---

## 3. The 6 Critical Database Invariants

| Invariant | Rule Definition | Database Enforcement Mechanism |
| :--- | :--- | :--- |
| **Invariant 1** | **Quantity Conservation**<br>$\text{allocated\_qty} + \text{backorder\_qty} = \text{requested\_qty}$ | PostgreSQL `CHECK (allocated_qty + backorder_qty = requested_qty)` on `fulfillment_plan_line`. |
| **Invariant 2** | **Score Bounds**<br>All scores, percentages, and margins must fall within $[0.00, 100.00]$. | PostgreSQL `CHECK` constraints on `deal.current_risk_score`, `risk_assessment.risk_score`, `discount_policy.*`. |
| **Invariant 3** | **Single Active Approval**<br>Only one active approval request per sequence per deal. | PostgreSQL Partial Unique Index: `idx_unique_active_approval ON approval_request(deal_id, sequence) WHERE status = 'PENDING'`. |
| **Invariant 4** | **Portal Mutation Isolation**<br>Customer counter-offers cannot alter Odoo transactions without approval. | Staged in `negotiation_change` diff table; gated by repository methods. |
| **Invariant 5** | **Audit Trail Immutability**<br>Every material decision emits an audit log. | `audit_event` table is strictly append-only (no `UPDATE` or `DELETE` operations permitted). |
| **Invariant 6** | **Explicit Odoo References**<br>Odoo keys use canonical `odoo_*_id` names. | Explicit column naming (`odoo_sale_order_id`, `odoo_partner_id`, `odoo_warehouse_id`) prevents ID ambiguity. |

---

## 4. Performance Indexing Strategy

Designed specifically to support the Manager Control Tower and analytical dashboard queries without full table scans:

```sql
-- Fast lookup from Odoo Sale Order to DealFlow Deal
CREATE INDEX idx_deal_odoo_so ON deal(odoo_sale_order_id);

-- Fast lookup for Customer Deal History
CREATE INDEX idx_deal_odoo_partner ON deal(odoo_partner_id);

-- Dashboard Query: "All deals pending approval"
CREATE INDEX idx_deal_status ON deal(status);
CREATE INDEX idx_deal_approval_state ON deal(approval_state);

-- Dashboard Query: "All at-risk or stalled deals"
CREATE INDEX idx_deal_health ON deal(health_status);

-- Time-series Risk Assessments per Deal
CREATE INDEX idx_risk_deal_calc ON risk_assessment(deal_id, calculated_at DESC);

-- Fast Queue Lookup: "Pending approvals for Sales Manager"
CREATE INDEX idx_app_req_level_status ON approval_request(required_level, status);

-- Audit Timeline Query: "All events for deal D-1042 ordered by time"
CREATE INDEX idx_audit_deal_time ON audit_event(deal_id, created_at DESC);
```

---

## 5. Migration Management (`migrations/`)

The migration architecture ensures reproducible schema deployments across development, staging, and live demo environments.

### File Structure:
- `migrations/001_canonical_schema.sql`: Full atomic DDL wrapped in `BEGIN ... COMMIT`.
- `migrations/migrate.py`: Automated Python runner with checksum validation.

### How the Migration Runner Operates:
1. Connects to PostgreSQL using the `DATABASE_URL` environment variable.
2. Checks for or creates the `schema_migrations` tracking table:
   ```sql
   CREATE TABLE IF NOT EXISTS schema_migrations (
       version VARCHAR(128) PRIMARY KEY,
       checksum VARCHAR(64) NOT NULL,
       applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```
3. Computes the SHA-256 hash of each SQL migration file in `migrations/`.
4. If the file is already recorded, verifies that the checksum has not mutated.
5. If the file is new, executes it inside an atomic transaction, records the version and checksum, and commits.
6. If any statement fails, rolls back the transaction immediately and halts.

---

## 6. Connection Pooling & Transaction Management (`db/connection.py`)

To ensure thread safety and prevent connection exhaustion under concurrent API traffic, the database layer provides a threaded connection pool.

### Architecture:
- Uses `psycopg2.pool.ThreadedConnectionPool`.
- Configurable pool limits via `DB_MIN_CONNECTIONS` (default: 2) and `DB_MAX_CONNECTIONS` (default: 10).
- Standard cursor uses `RealDictCursor` for dictionary-style row access.

### Context Managers:
```python
# Read-only or manual transaction
with get_db_connection() as conn:
    # use connection...

# Auto-commit / rollback transaction
with get_db_cursor(commit=True) as cur:
    cur.execute("UPDATE deal SET status = %s WHERE id = %s", ('APPROVED', deal_id))
    # Automatically commits on exit; automatically rolls back on any Exception
```

---

## 7. Data Contracts & Repository Layer

The repository layer isolates SQL queries from the rest of the application. Person 2 (Odoo) and Person 3 (Governance) interact exclusively through Python `dataclasses` defined in `db/contracts.py`:

```mermaid
flowchart LR
    P2[Person 2: Odoo Adapter] -->|DealContextDTO| P3[Person 3: Governance Engine]
    P3 -->|RiskAssessmentDTO / ApprovalRequestDTO| Repos[repositories/]
    Repos -->|SQL Execution via Pool| PG[(PostgreSQL)]
```

### Authoritative Repositories:
- `DealRepository`: Deal lifecycle creation, updates, and at-risk deal filtering.
- `PolicyRepository`: Resolves policies using the precedence rule:
  $$\text{Specific Category Policy} \to \text{Customer Tier Policy} \to \text{Global Policy}$$
- `RiskRepository`: Atomically stores `RiskAssessmentDTO` and child `RiskFactorDTO` rows.
- `ApprovalRepository`: Manages multi-step chains and invalidates active requests upon material deal changes.
- `NegotiationRepository`: Stages customer portal counter-offers without touching Odoo.
- `FulfillmentRepository`: Saves warehouse split plans with Invariant 1 quantity verification.
- `HealthRepository`: Records snapshots and queries stalled deals.
- `AuditRepository`: Appends immutable events to `audit_event`.

---

## 8. Deterministic Seed Data & Demo Scenarios (`db/seed.sql`)

The seed data script pre-loads policies and 4 complete scenarios to guarantee a predictable, bulletproof demo:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ SCENARIO 1: Clean Deal (Low Risk)                                           │
│ Order: SO-1001 | Customer: Acme Corp (Gold)                                 │
│ Result: Risk Score 12.00 | Severity: LOW | Decision: AUTO_APPROVED          │
├─────────────────────────────────────────────────────────────────────────────┤
│ SCENARIO 2: Risky Deal (High Risk - Finance Required)                        │
│ Order: SO-1042 | Customer: Beta Industries (Gold)                           │
│ Flags: Setup Service at 18% discount exceeds 10% ceiling by 8 points        │
│ Result: Risk Score 61.00 | Severity: HIGH | Route: Sales Manager -> Finance │
├─────────────────────────────────────────────────────────────────────────────┤
│ SCENARIO 3: Portal Negotiation Loop (Reapproval Trigger)                     │
│ Order: SO-1088 | Customer: Nova Retail (Silver)                             │
│ Flow: Quote approved -> Customer requests 22% discount counter-offer        │
│ Result: Staged in negotiation_change -> Deal marked REAPPROVAL / AT_RISK    │
├─────────────────────────────────────────────────────────────────────────────┤
│ SCENARIO 4: Multi-Warehouse Stock Allocation Split                          │
│ Order: SO-1105 | Product: 15 Laptops                                        │
│ Result: Split across Main Warehouse (9 units) and East Depot (6 units)      │
│ Invariant: 9 allocated + 6 allocated = 15 requested                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Operations Runbook: Quick Setup & Verification

### Step 1: Set Environment Variables
```bash
export DATABASE_URL="postgresql://dealflow_user:dealflow_pass@localhost:5432/dealflow360"
export DB_MIN_CONNECTIONS="2"
export DB_MAX_CONNECTIONS="10"
```

### Step 2: Apply Database Migrations
```bash
python migrations/migrate.py
```
*Output:*
```text
=== DealFlow360 Database Migration Runner ===
Discovered 1 migration files. 0 already applied.
  → Applying 001_canonical_schema.sql...
  ✓ Successfully applied 001_canonical_schema.sql
=== All migrations up to date ===
```

### Step 3: Populate Seed Data
```bash
python db/seed.py
```
*Output:*
```text
=== DealFlow360 Database Seed Loader ===
  ✓ Seed data successfully inserted into PostgreSQL!
```

### Step 4: Verify Database State
```sql
SELECT id, odoo_sale_order_id, status, approval_state, current_risk_score FROM deal;
```

---

## 10. Summary Checklist for Evaluators / Judges

- [x] **Clear Separation of Concerns**: Odoo owns transactions; DealFlow owns decisions.
- [x] **Canonical DDL (13 Tables)**: Fully normalized, UUID primary keys, explicit `odoo_*_id` references.
- [x] **Business Invariants Enforced at DB Level**: `CHECK` constraints prevent corrupted quantities or out-of-range risk scores.
- [x] **Explainable Risk Architecture**: Risk broken down into discrete weighted factor rows.
- [x] **Safe Customer Negotiation**: Diff-based staging tables prevent external portal users from altering ERP transactions.
- [x] **Thread-Safe Connection Pooling**: Built with `ThreadedConnectionPool` and context managers.
- [x] **Deterministic Migration & Seed Tooling**: Versioned migration tracking and pre-built demo scenarios.
