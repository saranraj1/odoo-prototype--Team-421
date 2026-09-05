# 🚀 DealFlow360 — Master Execution & Demonstration Guide

This single execution document provides the exact step-by-step commands, login credentials, and test flows to demonstrate all capabilities of **DealFlow360**.

---

## ⚡ Quick Start: Running the Application

### 1. Start the Development Server
From the project root:
```bash
npm run dev
```
Or inside the `frontend` folder:
```bash
cd frontend
npm run dev
```
> The application will start at **`http://localhost:5173/`**

### 2. Verify / Build Production Bundle
```bash
cd frontend
npm run build
```

---

## 🔐 Portals & Access URLs

DealFlow360 strictly segregates external customers from internal enterprise staff:

| Portal | URL | Purpose | Access Restrictions |
| :--- | :--- | :--- | :--- |
| **Enterprise Staff Portal** | `http://localhost:5173/#/enterprise-login` | Internal quotation builder, approval cockpit, admin controls | Rejects customer accounts with HTTP 403 |
| **B2B Customer Portal** | `http://localhost:5173/#/customer-login` | Quotation review, line counters, order confirmation | Rejects enterprise staff with HTTP 403 |

---

## 👥 Demo User Accounts & Credentials

All users start **strictly logged out by default**. To switch identities, you must log out and authenticate with the respective credentials:

| Role | Name | Username | Password | Key Responsibilities & Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **SALES_REP** | Rahul Sharma | `sales.rep` | `sales123` | Creates quotes, stays within customer tier cap, runs margin simulation. |
| **SALES_MANAGER** | Sunita Nair | `sales.manager` | `manager123` | **Exclusive authority** to classify customer tiers (Gold/Silver/Bronze), approves L1 discounts (>10%). |
| **FINANCE_DIRECTOR** | Vikram Malhotra | `finance.director` | `finance123` | Approves high-risk/L2 discounts (>15%), locks baseline prices. |
| **ADMIN** | System Admin | `admin` | `admin123` | Activates pending users, manages system assignments, logistics & fulfillment. |
| **UNASSIGNED_REP** | Ananya Verma | `rep.unassigned` | `sales123` | Test account showing **Access Pending Gate** until granted by Admin. |
| **CUSTOMER** | Acme Corp Procurement | `customer.demo` | `client123` | Reviews quotes, submits counteroffers, zero internal margin visibility. |

---

## 🧪 Step-by-Step Demonstration Workflows

---

### Flow 1: Customer Tier Caps & Discount Governance
**Objective:** Prove that discount caps are strictly enforced by customer tier and cannot be bypassed.

1. Navigate to `http://localhost:5173/#/enterprise-login`.
2. Log in as **Sales Rep** (`sales.rep` / `sales123`).
3. Select an existing quotation or start building a quote for **Acme Corporation** (Silver Tier: 10% max).
4. **Test within limit:** Change item discount to `8%` → Accepted immediately.
5. **Test exceeding limit:** Change item discount to `18%` → **Immediately Rejected** with a high-visibility policy violation banner:
   * *"Discount of 18.0% exceeds Silver customer tier cap of 10.0%."*
6. Notice that the system never silently clamps or accepts unapproved discounts.

---

### Flow 2: Sales Manager Customer Tier Classification
**Objective:** Demonstrate that only Sales Managers have the authority to change customer tiers.

1. While logged in as `sales.rep`, observe that customer tier controls are read-only / disabled.
2. Click **Logout** at top right.
3. Log in as **Sales Manager** (`sales.manager` / `manager123`).
4. Navigate to the **Customer Accounts** / **Governance & Tier Controls** section.
5. Select a customer and change their tier (e.g., promote **Apex Global** from *Bronze (5% cap)* to *Gold (15% cap)*).
6. Save the classification. The new policy threshold is immediately enforced for all future quotes.

---

### Flow 3: L1 & L2 Dual-Threshold Approval Workflow
**Objective:** Verify that quotes exceeding standard guidelines trigger the appropriate escalation path.

1. **L1 Escalation (Discount 10% – 15%):**
   * Log in as `sales.manager`.
   * Open the **Approval Center**.
   * Review pending L1 approval requests and approve or reject with audit commentary.
2. **L2 Escalation (High Risk / Discount > 15% / Negative Margin):**
   * Log out and log in as **Finance Director** (`finance.director` / `finance123`).
   * Access the **Executive Approval Cockpit**.
   * Review the Deal Guardian AI risk breakdown, margin protection metrics, and lock the deal baseline upon approval.

---

### Flow 4: Admin Work Assignment Gate
**Objective:** Demonstrate that unassigned staff cannot access workspace data until assigned by an Administrator.

1. Navigate to `http://localhost:5173/#/enterprise-login`.
2. Log in as unassigned user: `rep.unassigned` / `sales123`.
3. Observe the **Application Access Pending** security screen blocking all navigation and deal access.
4. Click **Log Out & Switch Account**.
5. Log in as **Admin** (`admin` / `admin123`).
6. In the **User Management & Assignment** console, locate `rep.unassigned` (Ananya Verma) and click **Activate Access / Assign Territory**.
7. Log out and log back in as `rep.unassigned` → Full workspace is now unlocked.

---

### Flow 5: Zero-Leakage B2B Customer Portal
**Objective:** Show that external clients only see client-safe pricing without internal cost or margin leakage.

1. Navigate to `http://localhost:5173/#/customer-login`.
2. Log in with customer credentials (`customer.demo` / `client123`).
3. View the customer quotation dashboard:
   * **Visible:** Product specifications, unit prices, quantity, customer discounts, subtotal, and tax.
   * **Hidden / Concealed:** Internal cost prices, profit margins, ERP sync parameters, and Deal Guardian risk scoring.
4. Submit a counteroffer on a line item with negotiation remarks.
5. Log out and log in as `sales.rep` to review the customer's counteroffer in the internal cockpit.

---

### Flow 6: Security Boundaries & HTTP 403 Forbidden Protection
**Objective:** Prove that route guards prevent unauthorized access and role escalation.

1. Log in to the **Customer Portal** (`customer.demo` / `client123`).
2. Attempt to manually navigate to the Admin Dashboard by entering `http://localhost:5173/#/admin` in the browser URL bar.
3. Observe the **HTTP 403 Access Forbidden** screen:
   * Displays attempted route: `#/admin`
   * Displays your current authenticated role: `CUSTOMER`
   * Action buttons to safely return to your authorized customer portal or switch accounts.
4. Attempt to log in with customer credentials on `#/enterprise-login` → Blocked with 403 Forbidden.
5. Attempt to log in with staff credentials on `#/customer-login` → Blocked with 403 Forbidden.

---

### Flow 7: Mandatory Re-Authentication (No Fake Switchers)
**Objective:** Verify that identities cannot be swapped on the client side without authenticating.

1. Notice that the top navbar has **no persona dropdown** and shows:
   * `[Logged In User Name] · [ROLE] 🔒 Verified Session`
2. To test another role, click **Log Out**.
3. You will be returned to the login screen where credentials must be entered to verify identity.

---

## 📊 Summary of Tier & Approval Matrix

```text
┌───────────────────────────────────────────────────────────────────────┐
│                       CUSTOMER TIER DISCOUNT CAPS                     │
├───────────────────┬───────────────────┬───────────────────────────────┤
│ Tier              │ Max Discount Cap  │ Managed By                    │
├───────────────────┼───────────────────┼───────────────────────────────┤
│ BRONZE            │ 5.0%              │ Sales Manager Only            │
│ SILVER            │ 10.0%             │ Sales Manager Only            │
│ GOLD              │ 15.0%             │ Sales Manager Only            │
└───────────────────┴───────────────────┴───────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────┐
│                       APPROVAL ESCALATION TIERS                       │
├───────────────────┬───────────────────┬───────────────────────────────┤
│ Threshold         │ Required Approver │ Action Taken                  │
├───────────────────┼───────────────────┼───────────────────────────────┤
│ <= Tier Cap       │ Sales Rep         │ Auto-approved for quote       │
│ > 10% (Tier Exceed│ Sales Manager     │ L1 Management Approval Req.   │
│ > 15% / High Risk │ Finance Director  │ L2 Executive Approval Req.    │
└───────────────────┴───────────────────┴───────────────────────────────┘
```

---

## 🛠️ Technical Reference

* **Cryptographic Session Service**: `frontend/src/security/authService.ts`
* **RBAC & Authorization Matrix**: `frontend/src/security/rbac.ts`
* **Route Guards & 403 Screen**: `frontend/src/App.tsx` & `frontend/src/components/auth/ForbiddenView.tsx`
* **Context & Tenant Isolation**: `frontend/src/app/providers/DealFlowContext.tsx`
