# DealFlow360 — Role-Based Access Control (RBAC) & Credentials Guide

This document contains the verified credentials, role definitions, and permission matrices for the **DealFlow360 Commercial Governance Platform**.

---

## 1. Authentication Endpoints

| Environment / Interface | URL Path | Description |
| :--- | :--- | :--- |
| **Enterprise Cockpit** | `/login` (or `/enterprise-login`) | Internal operations login for Reps, Managers, Finance, and Admins |
| **B2B Customer Portal** | `/portal/login` (or `/customer-login`) | Zero-Trust customer review, negotiation, and legal sign-off |
| **Customer Registration** | `/login` &rarr; tab "Customer Sign Up" | Self-service registration for new commercial buyers |

---

## 2. Credentials Directory

All pre-seeded enterprise and partner accounts use the standard security passphrase:
`Password123!`

### Enterprise Internal Roles

You can log in using either the **Username** or the **Email Address**.

| Persona | Role Identifier | Username | Email Address | Password | Primary Workspace | Authority & Scope |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **System Administrator** | `ADMIN` | `admin` | `admin@dealflow.test` | `Password123!` | `/` (Admin Dashboard) & `/config` | Platform-wide configuration, user provisioning, audit logs (Read-only audit on approvals; Segregation of Duties blocks commercial deal approval) |
| **Sales Manager** (Sunita Sharma) | `SALES_MANAGER` | `sales.manager` (or `manager1`) | `manager1@dealflow.test` | `Password123!` | `/` (Control Tower) & `/approvals` | Stage 1 Approval (Commercial discount sign-off), deal risk health, sales team oversight |
| **Finance Director** (Vikram Mehta) | `FINANCE` | `finance` | `finance@dealflow.test` | `Password123!` | `/` (Operations Dashboard) & `/invoices` | Stage 2 Approval (Margin floor & working capital sign-off), fulfillment routing, invoice & subscription reconciliation |
| **Sales Representative** (Rahul Verma) | `SALES_REP` | `sales.rep` (or `rep1`) | `rep1@dealflow.test` | `Password123!` | `/` (Sales Dashboard) & `/quotations` | Quotation workspace, pricing & margin simulation, customer quote dispatch (no self-approval) |

### Customer Portal Accounts

| Organization | Contact Name | Username | Email Address | Password | Portal Landing | Access Scope |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Acme Corp** | Alice Johnson | `buyer.acme` (or `buyer`) | `buyer@acme.test` | `Password123!` | `/portal/quotations` | Active quotation reviews (`D-1024`), counter-offers, accept/sign |
| **Beta Industries** | Bob Smith | `buyer.beta` | `buyer@beta.test` | `Password123!` | `/portal/quotations` | Industrial equipment order reviews & negotiation |
| **Nova Retail** | Carol Danvers | `buyer.gamma` | `buyer@gamma.test` | `Password123!` | `/portal/quotations` | Retail partner quotations and fulfillment tracking |
| **New Customer** | Self-registered | *(registered username)* | *(registered email)* | *(chosen password)* | `/portal/quotations` | Automatic customer onboarding with Zero-Trust isolation |

---

## 3. RBAC Permission & Route Matrix

| Route / Capability | Path | `SALES_REP` | `SALES_MANAGER` | `FINANCE` | `ADMIN` | `CUSTOMER` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Sales Dashboard** | `/` | &check; | &mdash; | &mdash; | &mdash; | &mdash; |
| **Control Tower** | `/` | &mdash; | &check; | &mdash; | &check; | &mdash; |
| **Operations Dashboard** | `/` | &mdash; | &mdash; | &check; | &mdash; | &mdash; |
| **Quotations & Pipeline** | `/quotations` | &check; | &check; | &check; | &check; | &mdash; |
| **Create New Quotation** | `/quotations/new` | &check; | &check; | &mdash; | &check; | &mdash; |
| **Quotation Workspace** | `/quotations/:id` | &check; | &check; | &check; | &check; | &mdash; |
| **Guardian Assessment** | `/quotations/:id/assessments/:aid` | &check; | &check; | &check; | &check; | &mdash; |
| **Approval Inbox** | `/approvals` | View own | Stage 1 Approver | Stage 2 Approver | Read-Only Audit | &mdash; |
| **Approval Decision** | `/approvals/:id` | &mdash; | &check; (Stage 1 only) | &check; (Stage 2 only) | &mdash; (SoD Audit Only) | &mdash; |
| **Fulfillment & Routing** | `/fulfillment` | View only | View only | Manage / Split | Manage / Split | &mdash; |
| **Subscriptions & Billing** | `/subscriptions` | View only | View only | Manage / Reconcile | Manage / Reconcile | &mdash; |
| **Invoices & Credit Notes** | `/invoices` | View only | View only | Full Control | Full Control | &mdash; |
| **Deal Health & Alerts** | `/deal-health` | &mdash; | &check; | &check; | &check; | &mdash; |
| **Commercial Reports** | `/reports` | &mdash; | &check; | &check; | &check; | &mdash; |
| **Product Master Catalog** | `/products` | View only | View only | View only | Create / Edit | &mdash; |
| **Platform Configuration** | `/config` | &mdash; | &check; (Rules) | &mdash; | Full Access | &mdash; |
| **Customer Quotation Portal** | `/portal/quotations` | &mdash; | &mdash; | &mdash; | &mdash; | &check; |
| **Online Counter-Offer** | `/portal/quotations/:id` | &mdash; | &mdash; | &mdash; | &mdash; | &check; |
| **Portal Profile & Activity** | `/portal/profile` | &mdash; | &mdash; | &mdash; | &mdash; | &check; |

---

## 4. Multi-Tier Governance Doctrine

### Tier 1: Sales Representative (`SALES_REP`)
- **Focus**: Deal origination and proposal tailoring.
- **Rules**:
  - Can configure line items, standard discounts, and payment terms.
  - Receives live margin guidance, target vs. floor pricing, and blended risk ratings.
  - **Zero Self-Approval**: Any discount exceeding policy thresholds triggers mandatory escalation to the Sales Manager.

### Tier 2: Sales Manager (`SALES_MANAGER`)
- **Focus**: Commercial velocity and margin preservation.
- **Authority**:
  - Level 1 approval for discounts up to 20% or blended risk score &le; 65.
  - Access to the **Control Tower**, tracking margin slippage, pipeline velocity, and team quota health.
  - Ability to request quotation rework or approve with written commercial stipulations.

### Tier 3: Finance Director (`FINANCE`)
- **Focus**: Working capital protection, credit risk, and revenue recognition.
- **Authority**:
  - Level 2 final approval for discounts &gt; 20%, low-margin deals (&lt; 25% gross margin), or custom payment terms (&gt; Net 45).
  - Multi-warehouse inventory split and fulfillment routing.
  - Monthly subscription activation and automated invoicing schedules.

### Tier 4: System Administrator (`ADMIN`)
- **Focus**: System governance, Odoo synchronization, and auditability.
- **Authority**:
  - Global configuration of Guardian risk weights, approval stages, and notification webhooks.
  - User provisioning, role assignments, and security audit logs.
  - **Segregation of Duties (SoD)**: System Administrators have read-only audit access on commercial quotations and approvals. In compliance with internal controls (SOX/SOC-2), Admins cannot approve, reject, or decide commercial transactions on behalf of business managers or finance.

### Tier 5: Customer (`CUSTOMER`)
- **Focus**: Transparent, friction-free B2B purchasing.
- **Zero-Trust Security**:
  - Internal cost structures, product margins, and approval thresholds are **strictly stripped** before rendering in the customer portal.
  - Can accept quotations, reject terms, or propose counter-discounts within authorized commercial bounds.

---

## 5. Walkthrough: Testing the Role Journey

1. **Test Commercial Proposal Creation**:
   - Sign in as Sales Rep: `rep1@dealflow.test` / `Password123!`
   - Navigate to `/quotations/new`, select customer **Acme Corp**, add items, and observe real-time Deal Guardian margin calculation.
   - Apply a 22% discount to trigger Level 2 Finance Approval requirement.
   - Click **Submit for Governance Approval**.

2. **Test Manager & Finance Multi-Tier Approval**:
   - Sign out and sign in as Sales Manager: `manager1@dealflow.test` / `Password123!`
   - Inspect `/approvals` and open the deal. Complete Level 1 sign-off.
   - Sign out and sign in as Finance Director: `finance@dealflow.test` / `Password123!`
   - Verify the deal escalated to Finance inbox. Approve Level 2.

3. **Test Customer Negotiation & Sign-Off**:
   - Navigate to `/portal/login`.
   - Sign in as Customer: `buyer@acme.test` / `Password123!`
   - Review the approved quotation at `/portal/quotations`.
   - Propose an online counter-offer or click **Accept & Confirm** to lock the deal.
