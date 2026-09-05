# DealFlow360 — The 8 Core Governance Principles

> **Architectural Doctrine and Business Invariants for Deal Guardian**  
> *Odoo Finale Hackathon | Team 421*  
> *"Odoo owns transactions. DealFlow owns decisions. Deal Guardian governs deal state."*

---

## Executive Overview

DealFlow360 sits between customer-facing sales operations and Odoo ERP. In traditional enterprise systems, quotations are static database records: a sales rep enters numbers, an approval flag is checked, and an invoice is generated. When commercial terms change mid-flight or inventory runs short, standard ERP systems fail to govern the outcome—resulting in severe margin erosion, unapproved discounts, and delivery failures.

To solve this, DealFlow360 operates on **8 Non-Negotiable Governance Principles**. These principles are not aspirational guidelines—they are mathematically enforced rules embedded into the Deal Guardian engine, validated across 47 automated invariant tests.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THE DEAL GUARDIAN PIPELINE                           │
│                                                                        │
│   Deal Change Event                                                    │
│         │                                                              │
│         ▼                                                              │
│   [Principle 1: Transactional Separation] ─── Build Normalized Context │
│         │                                                              │
│         ▼                                                              │
│   [Principle 2: Effective Ceiling Invariant] ─ Resolve MIN Ceilings    │
│         │                                                              │
│         ▼                                                              │
│   [Principle 7: Quantity Conservation] ────── Multi-Warehouse Stock    │
│         │                                                              │
│         ▼                                                              │
│   [Principle 3: Bounded & Explainable Risk] ── Calculate 0–100 Score   │
│         │                                                              │
│         ▼                                                              │
│   [Principle 4: Guarded Approval FSM] ─────── Route Approval Level     │
│         │                                                              │
│         ▼                                                              │
│   [Principle 5: Baseline Invalidation] ────── Check Baseline Drift     │
│         │                                                              │
│         ▼                                                              │
│   [Principle 8: Margin Accretion] ─────────── Recommend Add-Ons        │
│         │                                                              │
│         ▼                                                              │
│   [Principle 6: Proposal Isolation] ───────── Guard Portal Negotiations│
│         │                                                              │
│         ▼                                                              │
│   Synthesized Next Best Action & Immutable Audit Snapshot              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Principle 1: Transactional Separation of Concerns
> *"Odoo owns transactions. DealFlow owns decisions."*

* **The Rule**: DealFlow360 never duplicates master ERP data. Customer profiles (`res.partner`), product masters (`product.product`), standard costs, pricelists, stock quants (`stock.quant`), and general ledgers remain strictly inside Odoo. DealFlow stores only **decision state**: policy rules, risk assessments, baseline snapshots, approval histories, and audit events.
* **Technical Implementation**:
  * Implemented in [`backend/app/governance/context.py`](file:///c:/Hackathon/odoo/backend/app/governance/context.py) (`DealContext`, `CustomerContext`, `DealLineContext`) and [`interfaces.py`](file:///c:/Hackathon/odoo/backend/app/governance/interfaces.py).
  * DealFlow models reference external IDs (`odoo_sale_order_id`, `odoo_product_id`, `odoo_partner_id`) rather than duplicating ERP entities.
* **Why It Matters**: Prevents split-brain database sync issues. Upgrading Odoo (e.g., from v17 to v18) or connecting to multiple ERP instances requires zero changes to DealFlow's governance algorithms.
* **Adversarial Guard**: If Odoo is temporarily unreachable, DealFlow continues evaluating quotation risk in memory. No stale master data is ever cached permanently.

---

## Principle 2: The Strictest Effective Ceiling Invariant
> *"Specific category restrictions always override general customer tier privileges."*

* **The Rule**: The maximum allowable discount for any quotation line item is strictly the minimum between the customer's tier allowance and the product category's ceiling:
  $$\text{Effective Discount Ceiling} = \min(\text{Customer Tier Ceiling}, \text{Category Ceiling})$$
  $$\text{Discount Excess} = \max(0.0, \text{Actual Line Discount} - \text{Effective Discount Ceiling})$$
* **Example**:
  * Acme Corp is a **Gold Tier** customer (General discount entitlement: **15%**).
  * The rep quotes *Cloud Architecture Setup Service* (Category: **Services**, Ceiling: **10%**).
  * $\text{Effective Ceiling} = \min(15\%, 10\%) = 10\%$.
  * An 18% discount produces an **8% Policy Violation**, even though the customer is Gold Tier.
* **Technical Implementation**:
  * Implemented in [`backend/app/governance/policy/resolver.py`](file:///c:/Hackathon/odoo/backend/app/governance/policy/resolver.py) (`PolicyResolver.resolve_effective_limits()`).
  * Generates structured `PolicyReasonCode` (`DISCOUNT_EXCESS`, `EXACT_CEILING`, `WITHIN_POLICY`).
* **Why It Matters**: Prevents sales reps from using VIP customer status to sell zero-margin services or loss-leader products.
* **Adversarial Guard**: Boundary tests confirm that $10.01\%$ triggers a violation while $10.00\%$ passes cleanly.

---

## Principle 3: Bounded & Explainable Blended Risk
> *"Every point of financial risk must answer: What happened? How much did it contribute? Why does it matter?"*

* **The Rule**: Risk is not a vague sentiment or an opaque LLM score. It is an objective, deterministic value bounded strictly between 0 and 100:
  $$0 \le \text{Risk Score} \le 100$$
  $$\text{Risk Score} = \min(100, \text{Discount Points} + \text{Margin Points} + \text{Split Points} + \text{Delay Points})$$
* **The 4 Risk Dimensions**:
  1. **Discount Excess Contribution (up to 50 pts)**: Value-weighted excess percentage across all lines.
  2. **Margin Exposure Contribution (up to 30 pts)**: Penalty points when projected gross margin drops below target (e.g., 20%).
  3. **Fulfillment Split Contribution (up to 15 pts)**: Operational cost penalty when inventory shortages force multi-facility shipments.
  4. **Deal Delay Contribution (up to 20 pts)**: Penalty applied if a quotation sits inactive without customer engagement (>5 days).
* **Severity Levels**:
  * `LOW` (0–29): Auto-approval eligible.
  * `MEDIUM` (30–59): Sales Manager approval required.
  * `HIGH` (60–79): Finance Officer sign-off required.
  * `CRITICAL` (80–100): Executive Vice President review required.
* **Technical Implementation**:
  * Implemented in [`backend/app/governance/risk/calculator.py`](file:///c:/Hackathon/odoo/backend/app/governance/risk/calculator.py) and [`risk/explain.py`](file:///c:/Hackathon/odoo/backend/app/governance/risk/explain.py).
* **Why It Matters**: Eliminates subjective guesswork. When a CFO opens a deal, they see the exact mathematical attribution behind the score.
* **Adversarial Guard**: Verified across 1,000 continuous iterations; identical inputs produce the exact same 64-bit score with zero drift.

---

## Principle 4: Guarded Approval State Machine & Legal Transitions
> *"Approval status is a governed lifecycle, never a toggle switch."*

* **The Rule**: Deal approvals must follow a formal Finite State Machine (FSM). Unauthorized state jumps are strictly blocked by legal transition matrices:
  ```
  [DRAFT] ──┬──> [AUTO_APPROVED] ──> [APPROVED]
            ├──> [PENDING_MANAGER] ─┬──> [APPROVED]
            │                       ├──> [REJECTED]
            │                       └──> [RETURNED_FOR_REVISION]
            └──> [PENDING_FINANCE] ─┬──> [APPROVED]
                                    └──> [REJECTED]
                                    
  [APPROVED] ── (Material Change) ──> [INVALIDATED] ──> [PENDING_RE-APPROVAL]
  ```
* **Guarded Rules**:
  * A deal in `DRAFT` can **never** jump directly to `APPROVED` without passing through policy evaluation.
  * A deal rejected by Finance is in a terminal state until explicitly revised by the rep.
  * Every transition requires an authenticated actor, timestamp, and audit justification.
* **Technical Implementation**:
  * Implemented in [`backend/app/governance/approval/state_machine.py`](file:///c:/Hackathon/odoo/backend/app/governance/approval/state_machine.py) and [`approval/router.py`](file:///c:/Hackathon/odoo/backend/app/governance/approval/router.py).
* **Why It Matters**: Prevents rogue reps from bypassing manager reviews via API tampering or database flag flipping.
* **Adversarial Guard**: Automated test `test_illegal_approval_transition_rejected` asserts that invalid jumps throw explicit domain exceptions.

---

## Principle 5: The Invalidation Trigger (Approval Safety)
> *"An approval is valid if and only if the commercial reality matches the approved baseline."*

* **The Rule**: When a quotation is approved, Deal Guardian freezes an **immutable approved baseline snapshot**. Any subsequent change that deteriorates commercial terms instantly revokes the approval:
  $$\text{If } (\text{New Discount} > \text{Baseline Discount}) \lor (\text{New Margin} < \text{Baseline Margin} - 0.5\%) \implies \text{INVALIDATED}$$
* **The Killer Scenario ("The Counteroffer Trap")**:
  1. Rep quotes 18% discount $\rightarrow$ Finance approves as a strategic exception.
  2. Deal Guardian stores approved baseline: `Services Discount = 18%`.
  3. Customer opens portal and counteroffers: `22% discount`.
  4. **The Trigger**: `MaterialChangeDetector` catches $22\% > 18\%$.
  5. Approval is instantly **revoked to `INVALIDATED`**.
  6. Blended risk is recalculated, state resets to `PENDING_FINANCE`, and Next Best Action signals: *"Executive Re-Approval Required"*.
* **Harmless Change Filtering**: Non-commercial edits (typo fixes in customer notes, delivery address corrections) do not trigger invalidation.
* **Technical Implementation**:
  * Implemented in [`backend/app/governance/approval/invalidation.py`](file:///c:/Hackathon/odoo/backend/app/governance/approval/invalidation.py) (`MaterialChangeDetector.detect_changes()`).
* **Why It Matters**: Plugs the multi-million dollar revenue leak where sales reps quietly accept customer portal counteroffers on quotes that were already marked "Approved."
* **Adversarial Guard**: Verified end-to-end in `test_killer_scenario_customer_counteroffer_invalidates_approval`.

---

## Principle 6: Proposal vs. Transaction Isolation
> *"Customer negotiations are proposals for governance, never direct ERP mutations."*

* **The Rule**: External interactions submitted through the Customer Portal must never directly modify the live `sale.order` or `stock.picking` in Odoo. Counteroffers are ingested into an isolated, detached in-memory representation:
  $$\text{Customer Portal Action} \implies \text{Create Proposed Context Clone} \implies \text{Guardian Re-Evaluation} \implies \text{Manager Sign-Off} \implies \text{Odoo ERP Commit}$$
* **Zero Data Leakage Boundary**:
  * Customers see: Product description, requested quantity, unit sales price, and subtotal.
  * Customers **NEVER** see: Unit standard costs, line profit margins, deal blended risk scores, policy ceiling thresholds, or internal approval comments.
* **Technical Implementation**:
  * Implemented in [`backend/app/governance/negotiation/evaluator.py`](file:///c:/Hackathon/odoo/backend/app/governance/negotiation/evaluator.py) (`NegotiationEvaluator.create_proposed_context()`).
* **Why It Matters**: Protects commercial secrecy and prevents unauthenticated or malicious portal users from poisoning ERP order states.
* **Adversarial Guard**: Input validators reject negative quantities, discounts exceeding 100%, and SQL injection strings with HTTP 422 before reaching the decision engine.

---

## Principle 7: Physical Conservation of Quantity
> *"Inventory allocation must reflect physical reality before sales commitments are made."*

* **The Rule**: The total requested quantity of any physical product must exactly equal the sum of warehouse allocations plus recorded backorders:
  $$\sum_{w \in \text{Warehouses}} \text{Allocated Quantity}_w + \text{Backorder Quantity} \equiv \text{Requested Quantity}$$
* **Greedy Multi-Warehouse Allocation**:
  1. Satisfies line demand from the **Primary Warehouse** first.
  2. If primary stock is exhausted, splits the deficit across regional secondary depots (ordered by available inventory).
  3. If total enterprise inventory is insufficient, flags remaining shortfall as an explicit **Backorder**.
  4. Non-physical items (Services, SaaS subscriptions) bypass physical inventory allocation.
* **Technical Implementation**:
  * Implemented in [`backend/app/governance/fulfillment/planner.py`](file:///c:/Hackathon/odoo/backend/app/governance/fulfillment/planner.py) (`FulfillmentPlanner.plan_fulfillment()`).
* **Why It Matters**: Prevents sales reps from making impossible delivery promises that lead to expensive expedited shipping or order cancellations.
* **Adversarial Guard**: Validated in `test_fulfillment_conservation_invariant` across all inventory configurations (full primary, partial split, all backorder, zero stock).

---

## Principle 8: Margin Accretion over Margin Erosion
> *"Governance should not just block bad deals; it must actively build profitable ones."*

* **The Rule**: When discounting erodes profit margin, Deal Guardian deterministically scores and recommends high-margin complementary add-ons to recover gross profit:
  $$\text{Score} = (0.5 \times \text{CoPurchase Affinity}) + (0.3 \times \text{Margin Attractiveness}) + (0.2 \times \text{Promo Weight})$$
* **The Non-Negotiable Financial Guardrail**:
  $$\text{If } (\text{Price Unit} - \text{Cost Unit}) \le 0 \implies \text{FILTER OUT}$$
  * The recommendation engine will **never** suggest an accessory or service with zero or negative gross margin.
  * Products already present on the quotation are automatically excluded.
  * Suggestions are accompanied by plain-English financial justifications (e.g., *"Adds Thunderbolt Docking Station: +₹13,000 projected gross margin"*).
* **Technical Implementation**:
  * Implemented in [`backend/app/governance/recommendation/scorer.py`](file:///c:/Hackathon/odoo/backend/app/governance/recommendation/scorer.py) (`RecommendationScorer.generate_recommendations()`).
* **Why It Matters**: Transforms governance from a frustrating roadblock ("Sales Prevention Department") into an automated revenue and margin booster.
* **Adversarial Guard**: Verified in `test_negative_margin_products_filtered_out`.

---

## Summary Matrix: The 8 Principles in Action

| # | Principle | Primary Engine | Core Question Answered | Mathematical Invariant |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Transactional Separation** | Foundation ([`context.py`](file:///c:/Hackathon/odoo/backend/app/governance/context.py)) | *Where does truth live?* | Zero duplication of ERP master records |
| **2** | **Effective Ceiling** | Policy ([`policy/resolver.py`](file:///c:/Hackathon/odoo/backend/app/governance/policy/resolver.py)) | *Is this discount legal?* | $\text{Ceiling} = \min(\text{Tier}, \text{Category})$ |
| **3** | **Bounded Risk** | Risk ([`risk/calculator.py`](file:///c:/Hackathon/odoo/backend/app/governance/risk/calculator.py)) | *How dangerous is this quote?* | $0 \le \text{Risk Score} \le 100$ |
| **4** | **Guarded FSM** | Approval ([`approval/state_machine.py`](file:///c:/Hackathon/odoo/backend/app/governance/approval/state_machine.py)) | *Who has the right to approve?* | Transitions $\in \text{LEGAL\_TRANSITIONS}$ |
| **5** | **Baseline Invalidation** | Invalidation ([`approval/invalidation.py`](file:///c:/Hackathon/odoo/backend/app/governance/approval/invalidation.py)) | *Are approved terms still valid?* | $\text{Deterioration} \implies \text{INVALIDATED}$ |
| **6** | **Proposal Isolation** | Negotiation ([`negotiation/evaluator.py`](file:///c:/Hackathon/odoo/backend/app/governance/negotiation/evaluator.py)) | *Can customers poison ERP data?* | Portal action $\implies$ Proposal clone only |
| **7** | **Quantity Conservation** | Fulfillment ([`fulfillment/planner.py`](file:///c:/Hackathon/odoo/backend/app/governance/fulfillment/planner.py)) | *Can we physically deliver this?* | $\sum \text{Allocated} + \text{Backorder} \equiv \text{Requested}$ |
| **8** | **Margin Accretion** | Recommendation ([`recommendation/scorer.py`](file:///c:/Hackathon/odoo/backend/app/governance/recommendation/scorer.py)) | *How do we recover lost margin?* | $\text{Margin Delta} > 0$ strictly enforced |

---

## Verification & Automated Test Coverage

All 8 principles are continuously tested under `backend/tests`:

```bash
# Run the complete governance invariant suite (47 tests in 0.35s)
python -m pytest backend/tests -v
```

* **Adversarial Invariants**: [`test_adversarial_and_invariants.py`](file:///c:/Hackathon/odoo/backend/tests/test_adversarial_and_invariants.py) asserts negative prices, invalid discounts, zero totals, and 1,000-run determinism.
* **FSM Integrity**: [`test_approval_fsm.py`](file:///c:/Hackathon/odoo/backend/tests/test_approval_fsm.py) asserts illegal jumps raise exceptions.
* **Baseline Invalidation**: [`test_material_invalidation.py`](file:///c:/Hackathon/odoo/backend/tests/test_material_invalidation.py) tests counteroffer revoking approvals.
* **Fulfillment Integrity**: [`test_fulfillment_split.py`](file:///c:/Hackathon/odoo/backend/tests/test_fulfillment_split.py) verifies primary, secondary, and backorder balance conservation.
* **The Killer Golden Flow**: [`test_killer_demo_flow.py`](file:///c:/Hackathon/odoo/backend/tests/test_killer_demo_flow.py) tests all 8 principles working together across the complete 5-step lifecycle.
