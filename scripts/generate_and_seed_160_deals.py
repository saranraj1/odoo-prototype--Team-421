# -*- coding: utf-8 -*-
"""DealFlow360 160+ Realistic Multi-Perspective Deals Generator & Seeder.

Generates 160 rich, realistic, non-linear B2B commercial deals representing:
1. Sales Representative actions, revisions, drafts, policy dilemmas (Deals 1-35)
2. Sales Manager reviews, approvals, rejections, escalations (Deals 36-70)
3. Finance & Commercial Director reviews, credit risks, hybrid billing, proration (Deals 71-100)
4. Customer Portal negotiations, counteroffer trap invalidations, revisions (Deals 101-135)
5. Operations & Fulfillment logistics, multi-warehouse splits, backorders (Deals 136-160)
"""

import os
import sys
import uuid
import json
import random
from datetime import datetime, timedelta, timezone

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import psycopg2
from psycopg2.extras import execute_batch

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://dealflow_user:dealflow_pass@localhost:5432/dealflow360")

# -----------------------------------------------------------------------------
# Master Data & Personas
# -----------------------------------------------------------------------------
SALES_REPS = [
    {"id": 4, "name": "Sales Rep One", "email": "rep1@dealflow.test"},
    {"id": 5, "name": "Priya Sharma (Sr. Commercial Rep)", "email": "priya.sharma@dealflow.test"},
    {"id": 6, "name": "Rahul Verma (Enterprise Account Exec)", "email": "rahul.verma@dealflow.test"},
    {"id": 7, "name": "Ananya Sen (Mid-Market Sales Rep)", "email": "ananya.sen@dealflow.test"},
    {"id": 8, "name": "Rohan Patel (Hardware Solutions Rep)", "email": "rohan.patel@dealflow.test"},
]

SALES_MANAGERS = [
    {"id": 3, "name": "Sunita Rao (Sales Manager North)", "email": "manager1@dealflow.test"},
    {"id": 9, "name": "Arjun Nair (Sales Director West)", "email": "arjun.nair@dealflow.test"},
]

FINANCE_OFFICERS = [
    {"id": 2, "name": "Vikram Finance Officer", "email": "finance@dealflow.test"},
    {"id": 10, "name": "Meera Joshi (Commercial Finance Director)", "email": "meera.joshi@dealflow.test"},
]

ADMIN_USERS = [
    {"id": 1, "name": "System Administrator", "email": "admin@dealflow.test"}
]

CUSTOMERS = [
    {"partner_id": 101, "name": "Acme Global Technologies", "tier": "GOLD", "contact": "David Chen (VP Procurement)", "email": "dchen@acme.com"},
    {"partner_id": 102, "name": "Beta Industrial Robotics", "tier": "GOLD", "contact": "Elena Rostova (Operations Lead)", "email": "elena@betarobotics.com"},
    {"partner_id": 103, "name": "Nova Retail Chain India", "tier": "SILVER", "contact": "Rajesh Gupta (IT Director)", "email": "rajesh@novaretail.in"},
    {"partner_id": 104, "name": "Tata Consultancy Advanced Tech", "tier": "GOLD", "contact": "Sandeep Mehta (Strategic Sourcing)", "email": "sandeep.m@tcs-partner.com"},
    {"partner_id": 105, "name": "Reliance Digital Enterprises", "tier": "GOLD", "contact": "Kavita Singhania (VP Infrastructure)", "email": "kavita.s@reliancedigital.in"},
    {"partner_id": 106, "name": "Bharti Airtel Cloud Ops", "tier": "GOLD", "contact": "Amitabh Roy (Cloud Director)", "email": "amitabh.roy@airtelcloud.com"},
    {"partner_id": 107, "name": "Infosys BPM Systems", "tier": "SILVER", "contact": "Pooja Hegde (Procurement Mgr)", "email": "pooja.h@infosysbpm.com"},
    {"partner_id": 108, "name": "Wipro Cloud Infrastructure", "tier": "GOLD", "contact": "Karthik Raja (VP Engineering)", "email": "karthik.raja@wiprocloud.com"},
    {"partner_id": 109, "name": "Mahindra Automotive Systems", "tier": "GOLD", "contact": "Vikas Deshmukh (Supply Chain VP)", "email": "vikas.d@mahindraauto.com"},
    {"partner_id": 110, "name": "Larsen & Toubro Heavy Tech", "tier": "GOLD", "contact": "Harish Kulkarni (Procurement Head)", "email": "h.kulkarni@lntecc.com"},
    {"partner_id": 111, "name": "Delta Systems Inc", "tier": "SILVER", "contact": "Marcus Thorne (COO)", "email": "marcus@deltasystems.com"},
    {"partner_id": 112, "name": "Gamma Logistics LLC", "tier": "BRONZE", "contact": "Sunil Bansal (Owner)", "email": "sunil@gammalogistics.in"},
    {"partner_id": 113, "name": "Zeta Financial Technologies", "tier": "SILVER", "contact": "Chloe Bennett (Head of Infra)", "email": "cbennett@zetafin.io"},
    {"partner_id": 114, "name": "Omega Medical Devices", "tier": "GOLD", "contact": "Dr. Sameer Kapoor (Director)", "email": "sameer@omegamed.in"},
    {"partner_id": 115, "name": "Alpha Freight & Haulage", "tier": "BRONZE", "contact": "Suraj Mal (Transport Mgr)", "email": "suraj@alphafreight.in"},
    {"partner_id": 116, "name": "Theta Cyber Systems", "tier": "SILVER", "contact": "Nathaniel Reed (Security Lead)", "email": "nreed@theatacyber.com"},
    {"partner_id": 117, "name": "Sigma Electronics Corp", "tier": "SILVER", "contact": "Hiroshi Tanaka (Asia Sourcing)", "email": "htanaka@sigma-elec.com"},
    {"partner_id": 118, "name": "Apollo Health Solutions", "tier": "GOLD", "contact": "Nisha Reddy (CIO)", "email": "nisha.reddy@apollohealth.org"},
    {"partner_id": 119, "name": "Bajaj Finserv Digital", "tier": "GOLD", "contact": "Praveen Nair (Fintech Lead)", "email": "praveen.nair@bajajfinserv.in"},
    {"partner_id": 120, "name": "Kalyani Steel & Alloys", "tier": "BRONZE", "contact": "Balram Yadav (Plant Mgr)", "email": "byadav@kalyanisteel.com"},
    {"partner_id": 121, "name": "UrbanGrid Smart Energy", "tier": "SILVER", "contact": "Deepak Joshi (Projects Head)", "email": "deepak@urbangrid.io"},
    {"partner_id": 122, "name": "Starlight Hospitality Group", "tier": "BRONZE", "contact": "Monika Saxena (VP Operations)", "email": "monika@starlighthotels.com"},
    {"partner_id": 123, "name": "NexGen AI Laboratories", "tier": "SILVER", "contact": "Dr. Sarah Lin (Research Lead)", "email": "slin@nexgenai.ai"},
    {"partner_id": 124, "name": "OmniChannel Retail Solutions", "tier": "SILVER", "contact": "Gaurav Malhotra (Operations VP)", "email": "gaurav@omnichannel.in"},
    {"partner_id": 125, "name": "Quantum Precision Tools", "tier": "BRONZE", "contact": "Dharmendra Shah (Founder)", "email": "dshah@quantumtools.in"},
]

PRODUCTS = [
    {"id": 1, "name": "Enterprise Laptop Pro 14", "category": "Hardware", "category_id": 1, "list_price": 125000.0, "cost_price": 92000.0, "weight": 2.2},
    {"id": 2, "name": "UltraBook Executive 13", "category": "Hardware", "category_id": 1, "list_price": 95000.0, "cost_price": 71000.0, "weight": 1.4},
    {"id": 3, "name": "Cloud Rack Server X1", "category": "Hardware", "category_id": 1, "list_price": 450000.0, "cost_price": 310000.0, "weight": 28.0},
    {"id": 4, "name": "AI Edge Workstation Dual-GPU", "category": "Hardware", "category_id": 1, "list_price": 320000.0, "cost_price": 235000.0, "weight": 14.5},
    {"id": 5, "name": "Enterprise 4K Monitor 32\"", "category": "Hardware", "category_id": 1, "list_price": 55000.0, "cost_price": 38000.0, "weight": 8.5},
    {"id": 6, "name": "Universal Thunderbolt 4 Dock", "category": "Accessories", "category_id": 3, "list_price": 18000.0, "cost_price": 9500.0, "weight": 1.1},
    {"id": 7, "name": "Cloud Architecture Setup Service", "category": "Services", "category_id": 2, "list_price": 150000.0, "cost_price": 85000.0, "weight": 0.0},
    {"id": 8, "name": "Premium 24x7 Support & SLA", "category": "Services", "category_id": 2, "list_price": 75000.0, "cost_price": 32000.0, "weight": 0.0},
    {"id": 9, "name": "DevOps Implementation Consulting", "category": "Services", "category_id": 2, "list_price": 220000.0, "cost_price": 120000.0, "weight": 0.0},
    {"id": 10, "name": "CyberSecurity Audit & PenTest", "category": "Services", "category_id": 2, "list_price": 180000.0, "cost_price": 95000.0, "weight": 0.0},
    {"id": 11, "name": "DealFlow360 Enterprise SaaS Seat", "category": "Subscription", "category_id": 4, "list_price": 4500.0, "cost_price": 900.0, "is_sub": True, "weight": 0.0},
    {"id": 12, "name": "AI Ops Continuous Monitoring Plan", "category": "Subscription", "category_id": 4, "list_price": 35000.0, "cost_price": 8500.0, "is_sub": True, "weight": 0.0},
]

WAREHOUSES = [
    {"id": 1, "name": "Mumbai Central Main Warehouse", "location": "Bhiwandi, Mumbai", "weight": 1.0, "primary": True},
    {"id": 2, "name": "Bangalore East Depot", "location": "Whitefield, Bangalore", "weight": 1.25, "primary": False},
    {"id": 3, "name": "Delhi Northern Distribution Hub", "location": "Gurgaon, NCR", "weight": 1.4, "primary": False},
    {"id": 4, "name": "Hyderabad Tech Park Depot", "location": "Gachibowli, Hyderabad", "weight": 1.2, "primary": False},
]

def generate_160_dataset():
    random.seed(42)  # Deterministic seed
    now = datetime.now(timezone.utc)
    
    deals = []
    risk_assessments = []
    risk_factors = []
    approval_requests = []
    approval_actions = []
    negotiation_requests = []
    negotiation_changes = []
    fulfillment_plans = []
    fulfillment_plan_lines = []
    recommendations = []
    health_snapshots = []
    audit_events = []
    subscription_events = []

    for i in range(1, 161):
        deal_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.deal.{i:04d}"))
        so_id = 2000 + i
        deal_ref = f"D-{so_id}"
        order_name = f"SO-2026-{i:03d}"
        
        # Pick customer & rep deterministically
        cust = CUSTOMERS[(i - 1) % len(CUSTOMERS)]
        rep = SALES_REPS[(i - 1) % len(SALES_REPS)]
        mgr = SALES_MANAGERS[(i - 1) % len(SALES_MANAGERS)]
        fin = FINANCE_OFFICERS[(i - 1) % len(FINANCE_OFFICERS)]
        
        # Calculate time offset between 30 days ago and 1 hour ago
        age_hours = (160 - i) * 4.5 + random.uniform(0.5, 3.5)
        created_at = now - timedelta(hours=age_hours)
        updated_at = created_at + timedelta(hours=random.uniform(0.2, min(age_hours, 24.0)))

        # Assign Category / Perspective
        # Group 1: Deals 1-35 -> Sales Rep Actions, Revisions, Drafts, Dilemmas
        # Group 2: Deals 36-70 -> Sales Manager Reviews, Approvals, Rejections, Escalations
        # Group 3: Deals 71-100 -> Finance Reviews, Credit Risks, Hybrid Billing, Proration
        # Group 4: Deals 101-135 -> Customer Portal Negotiations, Counteroffer Trap Invalidation
        # Group 5: Deals 136-160 -> Operations & Warehouse Fulfillment Splits, Backorders
        
        if 1 <= i <= 35:
            perspective = "SALES_REP"
            if i <= 10: # Fresh drafts
                status = "DRAFT"
                approval_state = "NONE"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(5.0, 18.0), 1)
                amount = random.choice([75000, 145000, 280000, 450000, 620000])
                scenario_desc = "Early exploratory draft quotation created by Sales Rep"
            elif i <= 18: # Multi-revision active drafting
                status = "DRAFT"
                approval_state = "NONE"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(15.0, 24.5), 1)
                amount = random.choice([320000, 580000, 890000, 1150000])
                scenario_desc = f"Quotation Revision v{random.randint(2, 4)} undergoing customer review"
            elif i <= 25: # Returned by manager for revision
                status = "DRAFT"
                approval_state = "RETURNED"
                health_status = "AT_RISK"
                risk_score = round(random.uniform(42.0, 58.0), 1)
                amount = random.choice([420000, 690000, 950000, 1400000])
                scenario_desc = "Returned by Sales Manager: Service discount exceeds margin floor"
            elif i <= 30: # Accidental policy breach
                status = "EVALUATED"
                approval_state = "PENDING_MANAGER"
                health_status = "AT_RISK"
                risk_score = round(random.uniform(75.0, 92.0), 1)
                amount = random.choice([850000, 1250000, 2100000])
                scenario_desc = "Critical Risk: Rogue 25% discount entered on Bronze account"
            else: # Stalled quotes needing rep nudge
                status = "DRAFT"
                approval_state = "NONE"
                health_status = "STALLED"
                risk_score = round(random.uniform(22.0, 36.0), 1)
                amount = random.choice([180000, 290000, 510000])
                scenario_desc = "Stalled opportunity: Inactive for 14 days without customer follow-up"

        elif 36 <= i <= 70:
            perspective = "SALES_MANAGER"
            if i <= 48: # Pending Manager Review
                status = "PENDING_APPROVAL"
                approval_state = "PENDING_MANAGER"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(28.0, 48.0), 1)
                amount = random.choice([380000, 520000, 740000, 920000, 1200000])
                scenario_desc = "Tier 1 Approval Queue: Line discount (12%) exceeds category cap (10%)"
            elif i <= 58: # Approved by Manager
                status = "APPROVED"
                approval_state = "APPROVED"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(25.0, 42.0), 1)
                amount = random.choice([450000, 680000, 890000, 1350000])
                scenario_desc = "Approved by Sales Manager: Concession granted for multi-year relationship"
            elif i <= 64: # Rejected by Manager
                status = "DRAFT"
                approval_state = "REJECTED"
                health_status = "CRITICAL"
                risk_score = round(random.uniform(62.0, 84.0), 1)
                amount = random.choice([550000, 980000, 1750000])
                scenario_desc = "Rejected by Manager: Negative gross margin contribution detected"
            else: # Escalated stalled deals
                status = "PENDING_APPROVAL"
                approval_state = "PENDING_MANAGER"
                health_status = "STALLED"
                risk_score = round(random.uniform(45.0, 68.0), 1)
                amount = random.choice([880000, 1420000, 2200000])
                scenario_desc = "Manager Escalation: Approval delayed >72 hours; rep nudged"

        elif 71 <= i <= 100:
            perspective = "FINANCE"
            if i <= 78: # Pending Finance Review
                status = "PENDING_APPROVAL"
                approval_state = "PENDING_FINANCE"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(55.0, 72.0), 1)
                amount = random.choice([1650000, 2400000, 3200000, 4800000])
                scenario_desc = "High Value Enterprise Quote (>₹15L): Mandatory Finance sign-off"
            elif i <= 86: # Approved by Finance
                status = "APPROVED"
                approval_state = "APPROVED"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(50.0, 65.0), 1)
                amount = random.choice([1850000, 2900000, 3950000])
                scenario_desc = "Approved by Commercial Finance: Strategic discount offset by 3-yr commitment"
            elif i <= 92: # Billing & Credit disputes
                status = "BILLING"
                approval_state = "APPROVED"
                health_status = "AT_RISK"
                risk_score = round(random.uniform(48.0, 62.0), 1)
                amount = random.choice([950000, 1850000, 2750000])
                scenario_desc = "Credit Warning: Customer payment terms dispute on Net-90 request"
            elif i <= 96: # Subscription Proration / Hybrid Billing
                status = "BILLING"
                approval_state = "APPROVED"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(18.0, 32.0), 1)
                amount = random.choice([340000, 780000, 1250000])
                scenario_desc = "Hybrid Billing: Mid-cycle SaaS seat upgrade with prorated credit note"
            else: # Closed & Reconciled
                status = "CLOSED"
                approval_state = "APPROVED"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(10.0, 25.0), 1)
                amount = random.choice([820000, 1450000, 2100000])
                scenario_desc = "Successfully Closed: Order confirmed, invoiced and payment reconciled"

        elif 101 <= i <= 135:
            perspective = "CUSTOMER_PORTAL"
            if i <= 113: # The Counteroffer Trap: Prior approval invalidated!
                status = "NEGOTIATION"
                approval_state = "PENDING_FINANCE"
                health_status = "AT_RISK"
                risk_score = round(random.uniform(62.0, 78.0), 1)
                amount = random.choice([750000, 1150000, 1680000, 2350000])
                scenario_desc = "Counteroffer Trap: Customer countered with 22% on portal; previous 18% approval INVALIDATED!"
            elif i <= 122: # Active portal negotiation
                status = "NEGOTIATION"
                approval_state = "PENDING_MANAGER"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(34.0, 52.0), 1)
                amount = random.choice([490000, 720000, 1100000])
                scenario_desc = "Customer Portal Negotiation: Customer requested 15% discount + free docking stations"
            elif i <= 127: # Customer accepted on portal
                status = "READY"
                approval_state = "APPROVED"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(15.0, 28.0), 1)
                amount = random.choice([620000, 890000, 1340000])
                scenario_desc = "Customer Accepted Terms: Digital confirmation received on portal; awaiting ERP commit"
            elif i <= 131: # Customer rejected deal
                status = "CLOSED"
                approval_state = "REJECTED"
                health_status = "CRITICAL"
                risk_score = round(random.uniform(30.0, 55.0), 1)
                amount = random.choice([390000, 650000, 920000])
                scenario_desc = "Customer Rejected: Quote declined on portal citing competitor pricing"
            else: # Reopened negotiation
                status = "NEGOTIATION"
                approval_state = "PENDING_MANAGER"
                health_status = "WATCH" if "WATCH" in ("HEALTHY", "STALLED", "AT_RISK", "CRITICAL") else "AT_RISK"
                risk_score = round(random.uniform(40.0, 55.0), 1)
                amount = random.choice([580000, 840000, 1450000])
                scenario_desc = "Reopened Negotiation: Customer requested revised quote after budget expansion"

        else: # 136 <= i <= 160
            perspective = "OPERATIONS_FULFILLMENT"
            if i <= 144: # Single warehouse clean fulfillment
                status = "FULFILLING"
                approval_state = "APPROVED"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(10.0, 22.0), 1)
                amount = random.choice([350000, 620000, 980000, 1400000])
                scenario_desc = "Fulfillment Planning: 100% stock available at Mumbai Central Main Warehouse"
            elif i <= 152: # Multi-warehouse split
                status = "FULFILLING"
                approval_state = "APPROVED"
                health_status = "HEALTHY"
                risk_score = round(random.uniform(32.0, 48.0), 1)
                amount = random.choice([680000, 1150000, 1850000])
                scenario_desc = "Multi-Warehouse Split: 60% Mumbai Main + 40% Bangalore East Depot"
            elif i <= 157: # Partial backorders
                status = "FULFILLING"
                approval_state = "APPROVED"
                health_status = "AT_RISK"
                risk_score = round(random.uniform(52.0, 68.0), 1)
                amount = random.choice([890000, 1450000, 2250000])
                scenario_desc = "Partial Backorder: 15 units shipped immediately, 10 units on backorder"
            else: # Critical supply chain stockout
                status = "READY"
                approval_state = "APPROVED"
                health_status = "CRITICAL"
                risk_score = round(random.uniform(70.0, 85.0), 1)
                amount = random.choice([1200000, 2100000, 3400000])
                scenario_desc = "Supply Chain Alert: High-performance GPUs out of stock across all facilities"

        # Severity mapping
        if risk_score < 25.0:
            severity = "LOW"
            decision = "AUTO_APPROVED"
        elif risk_score < 50.0:
            severity = "MEDIUM"
            decision = "MANAGER_APPROVAL"
        elif risk_score < 75.0:
            severity = "HIGH"
            decision = "FINANCE_APPROVAL"
        else:
            severity = "CRITICAL"
            decision = "REJECTED"

        # 1. Deal Record
        deals.append({
            "id": deal_uuid,
            "odoo_sale_order_id": so_id,
            "odoo_partner_id": cust["partner_id"],
            "owner_user_id": rep["id"],
            "company_id": 1,
            "status": status,
            "approval_state": approval_state,
            "health_status": health_status,
            "current_risk_score": risk_score,
            "created_at": created_at,
            "updated_at": updated_at,
            # Metadata for JSON/Mock usage
            "deal_reference": deal_ref,
            "order_name": order_name,
            "customer_name": cust["name"],
            "customer_tier": cust["tier"],
            "customer_contact": cust["contact"],
            "amount": amount,
            "owner_name": rep["name"],
            "scenario_desc": scenario_desc,
            "perspective": perspective,
            "severity": severity,
        })

        # 2. Risk Assessment Record
        ra_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.ra.{i:04d}"))
        risk_assessments.append({
            "id": ra_uuid,
            "deal_id": deal_uuid,
            "risk_score": risk_score,
            "severity": severity,
            "decision": decision,
            "trigger_type": "PORTAL_COUNTEROFFER" if perspective == "CUSTOMER_PORTAL" else ("SYSTEM_EVALUATION" if i % 2 == 0 else "LINE_DISCOUNT_EXCEEDED"),
            "policy_version": "v1.0",
            "calculated_at": updated_at,
        })

        # 3. Risk Factors (2-3 factors per deal)
        rf1_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.rf.{i:04d}.1"))
        rf2_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.rf.{i:04d}.2"))
        
        # Primary factor
        if risk_score > 40:
            factor_type = "LINE_DISCOUNT_EXCESS"
            raw_val = round(risk_score * 0.4, 1)
            contrib = round(risk_score * 0.6, 1)
            reason = f"Line discount exceeds {cust['tier']} tier ceiling by {round(raw_val - 10, 1)} points"
        else:
            factor_type = "DISCOUNT_MARGIN"
            raw_val = round(risk_score * 0.5, 1)
            contrib = round(risk_score * 0.7, 1)
            reason = f"Discount within policy discretion for {cust['tier']} tier account"

        risk_factors.append({
            "id": rf1_uuid,
            "risk_assessment_id": ra_uuid,
            "factor_type": factor_type,
            "source_reference": f"Line 1 ({order_name})",
            "raw_value": raw_val,
            "weight": 1.5,
            "contribution": contrib,
            "reason": reason,
        })

        # Secondary factor (Fulfillment or staleness)
        if health_status in ("STALLED", "AT_RISK", "CRITICAL"):
            sec_type = "STALLED_INACTIVITY"
            sec_val = random.randint(7, 21)
            sec_contrib = round(risk_score * 0.3, 1)
            sec_reason = f"Quotation inactive for {sec_val} days without commercial progress"
        else:
            sec_type = "DELIVERY_RISK"
            sec_val = 1.0 if perspective != "OPERATIONS_FULFILLMENT" else 2.0
            sec_contrib = round(risk_score * 0.2, 1)
            sec_reason = "Single warehouse fulfillment available" if sec_val == 1.0 else "Multi-warehouse split allocation penalty"

        risk_factors.append({
            "id": rf2_uuid,
            "risk_assessment_id": ra_uuid,
            "factor_type": sec_type,
            "source_reference": f"Operations ({order_name})",
            "raw_value": float(sec_val),
            "weight": 1.0,
            "contribution": sec_contrib,
            "reason": sec_reason,
        })

        # 4. Approval Requests & Actions
        if approval_state in ("PENDING_MANAGER", "PENDING_FINANCE", "APPROVED", "REJECTED", "RETURNED"):
            app_req_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.app_req.{i:04d}.1"))
            req_level = "FINANCE" if (approval_state == "PENDING_FINANCE" or risk_score >= 50.0) else "SALES_MANAGER"
            app_status = "PENDING" if approval_state.startswith("PENDING") else approval_state
            
            approval_requests.append({
                "id": app_req_uuid,
                "deal_id": deal_uuid,
                "risk_assessment_id": ra_uuid,
                "required_level": req_level,
                "sequence": 1,
                "status": app_status,
                "requested_at": created_at + timedelta(minutes=30),
                "completed_at": updated_at if app_status != "PENDING" else None,
                "expires_at": created_at + timedelta(days=7),
            })

            # If an action was taken (APPROVED, REJECTED, RETURNED)
            if app_status in ("APPROVED", "REJECTED", "RETURNED"):
                act_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.app_act.{i:04d}.1"))
                actor = fin["id"] if req_level == "FINANCE" else mgr["id"]
                actor_name = fin["name"] if req_level == "FINANCE" else mgr["name"]
                
                if app_status == "APPROVED":
                    act_reason = f"Commercial terms approved by {actor_name}. Strategic margin deemed accretive."
                elif app_status == "REJECTED":
                    act_reason = f"Commercial terms rejected by {actor_name}. Gross margin falls below executive guidelines."
                else:
                    act_reason = f"Returned to {rep['name']} by {actor_name}. Restructure quote to bundle annual support."

                approval_actions.append({
                    "id": act_uuid,
                    "approval_request_id": app_req_uuid,
                    "actor_user_id": actor,
                    "action": app_status,
                    "reason": act_reason,
                    "created_at": updated_at,
                })

        # 5. Customer Portal Negotiations
        if perspective == "CUSTOMER_PORTAL" or i % 7 == 0:
            neg_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.neg.{i:04d}"))
            neg_status = "PENDING" if status == "NEGOTIATION" else ("ACCEPTED" if status in ("READY", "FULFILLING", "CLOSED") else "COUNTERED")
            
            if 101 <= i <= 113:
                neg_msg = f"We cannot sign at 18% discount. If you can provide 22% on Enterprise Laptops and Net-60 terms, we will issue PO today. - {cust['contact']}"
                old_val = "18.00"
                req_val = "22.00"
            elif 114 <= i <= 122:
                neg_msg = f"Can you bundle free 24x7 Support and increase unit quantity from 10 to 15? - {cust['contact']}"
                old_val = "10.00"
                req_val = "15.00"
            else:
                neg_msg = f"Requesting additional 3% commercial discount to meet our fiscal year cap. - {cust['contact']}"
                old_val = "12.00"
                req_val = "15.00"

            negotiation_requests.append({
                "id": neg_uuid,
                "deal_id": deal_uuid,
                "odoo_sale_order_id": so_id,
                "customer_partner_id": cust["partner_id"],
                "requested_by": "CUSTOMER",
                "status": neg_status,
                "message": neg_msg,
                "created_at": created_at + timedelta(hours=2),
                "processed_at": updated_at if neg_status != "PENDING" else None,
            })

            change_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.neg_chg.{i:04d}"))
            negotiation_changes.append({
                "id": change_uuid,
                "negotiation_request_id": neg_uuid,
                "odoo_sale_order_line_id": so_id * 10 + 1,
                "field_name": "discount_pct",
                "old_value": old_val,
                "requested_value": req_val,
            })

        # 6. Fulfillment Plans
        if perspective == "OPERATIONS_FULFILLMENT" or status in ("READY", "FULFILLING", "BILLING", "CLOSED"):
            ful_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.ful.{i:04d}"))
            is_split = (152 <= i <= 160) or (i % 3 == 0)
            ful_status = "EXECUTED" if status in ("BILLING", "CLOSED") else "ACCEPTED"
            
            fulfillment_plans.append({
                "id": ful_uuid,
                "deal_id": deal_uuid,
                "odoo_sale_order_id": so_id,
                "status": ful_status,
                "estimated_shipments": 2 if is_split else 1,
                "estimated_shipping_cost": 4850.0 if is_split else 1250.0,
                "algorithm_version": "v1.0",
                "generated_at": created_at + timedelta(hours=3),
            })

            # Line 1: Main Warehouse
            fline1_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.fline.{i:04d}.1"))
            req_q = 12.0 if is_split else 20.0
            alloc_q = 12.0 if is_split else 20.0
            back_q = 0.0
            fulfillment_plan_lines.append({
                "id": fline1_uuid,
                "fulfillment_plan_id": ful_uuid,
                "odoo_product_id": 1,
                "odoo_warehouse_id": 1,
                "requested_qty": req_q,
                "allocated_qty": alloc_q,
                "backorder_qty": back_q,
                "shipping_cost": 1250.0,
            })

            # Line 2: If split or backorder
            if is_split:
                fline2_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.fline.{i:04d}.2"))
                alloc_q2 = 8.0 if i <= 156 else 4.0
                back_q2 = 0.0 if i <= 156 else 4.0
                req_q2 = alloc_q2 + back_q2
                fulfillment_plan_lines.append({
                    "id": fline2_uuid,
                    "fulfillment_plan_id": ful_uuid,
                    "odoo_product_id": 1,
                    "odoo_warehouse_id": 2,
                    "requested_qty": req_q2,
                    "allocated_qty": alloc_q2,
                    "backorder_qty": back_q2,
                    "shipping_cost": 3600.0,
                })

        # 7. Recommendations (Upsell & Accretive Addons)
        rec_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.rec.{i:04d}"))
        rec_prod = PRODUCTS[(i + 4) % len(PRODUCTS)]
        recommendations.append({
            "id": rec_uuid,
            "deal_id": deal_uuid,
            "odoo_product_id": rec_prod["id"],
            "recommendation_type": "UPSELL" if rec_prod["category"] == "Hardware" else "MARGIN_BOOST",
            "score": round(random.uniform(72.0, 96.0), 1),
            "margin_delta": round(rec_prod["list_price"] - rec_prod["cost_price"], 2),
            "reason": f"High co-purchase affinity with {cust['tier']} accounts. Boosts gross margin by +₹{rec_prod['list_price'] - rec_prod['cost_price']:,.0f}.",
            "source": "CO_PURCHASE",
            "status": "ACCEPTED" if i % 4 == 0 else "ACTIVE",
            "created_at": created_at,
            "dismissed_at": None,
        })

        # 8. Deal Health Snapshots
        health_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.health.{i:04d}"))
        health_snapshots.append({
            "id": health_uuid,
            "deal_id": deal_uuid,
            "health_status": health_status,
            "overall_score": round(100.0 - risk_score * 0.75, 1),
            "stalled_score": 45.0 if health_status == "STALLED" else 5.0,
            "discount_anomaly_score": 50.0 if risk_score > 60 else 10.0,
            "delivery_risk_score": 30.0 if perspective == "OPERATIONS_FULFILLMENT" else 5.0,
            "approval_delay_score": 35.0 if approval_state.startswith("PENDING") else 0.0,
            "calculated_at": updated_at,
        })

        # 9. Audit Events
        audit_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.audit.{i:04d}"))
        audit_events.append({
            "id": audit_uuid,
            "deal_id": deal_uuid,
            "event_type": "DEAL_EVALUATED",
            "actor_type": "SYSTEM",
            "actor_id": 1,
            "entity_type": "deal",
            "entity_id": deal_uuid,
            "before_state": json.dumps({"status": "DRAFT", "risk_score": 0.0}),
            "after_state": json.dumps({"status": status, "approval_state": approval_state, "risk_score": risk_score}),
            "reason": scenario_desc,
            "metadata": json.dumps({"order_name": order_name, "customer": cust["name"], "perspective": perspective}),
            "created_at": updated_at,
        })

        # 10. Subscription & Proration Events (For Subscription deals)
        if 93 <= i <= 96:
            sub_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"dealflow.sub.{i:04d}"))
            subscription_events.append({
                "id": sub_uuid,
                "deal_id": deal_uuid,
                "odoo_subscription_id": 8000 + i,
                "event_type": "QUANTITY_CHANGE",
                "old_plan": "DealFlow360 Growth Tier (25 Seats)",
                "new_plan": "DealFlow360 Enterprise Tier (50 Seats)",
                "old_quantity": 25,
                "new_quantity": 50,
                "billing_cycle": "YEARLY",
                "proration_days_remaining": 142,
                "proration_total_days": 365,
                "prorated_amount": 175000.0,
                "credit_note_amount": 35000.0,
                "odoo_credit_note_id": 9000 + i,
                "reason": "Mid-cycle enterprise seat expansion with prorated credit offset",
                "created_at": updated_at,
            })

    return {
        "deals": deals,
        "risk_assessments": risk_assessments,
        "risk_factors": risk_factors,
        "approval_requests": approval_requests,
        "approval_actions": approval_actions,
        "negotiation_requests": negotiation_requests,
        "negotiation_changes": negotiation_changes,
        "fulfillment_plans": fulfillment_plans,
        "fulfillment_plan_lines": fulfillment_plan_lines,
        "recommendations": recommendations,
        "health_snapshots": health_snapshots,
        "audit_events": audit_events,
        "subscription_events": subscription_events,
    }

def seed_postgres(data):
    print("Connecting to PostgreSQL to seed 160 realistic deals...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # 1. Clean existing test data cleanly
    print("  -> Cleaning previous test records...")
    cur.execute("TRUNCATE TABLE deal CASCADE;")
    cur.execute("TRUNCATE TABLE discount_policy CASCADE;")
    cur.execute("TRUNCATE TABLE warehouse_config CASCADE;")
    cur.execute("TRUNCATE TABLE upsell_rule CASCADE;")

    # 2. Seed discount policies
    print("  -> Seeding discount policies...")
    cur.execute("""
    INSERT INTO discount_policy (
        id, name, customer_tier, product_category_id, max_discount_pct, manager_threshold, finance_threshold, minimum_margin_pct, priority, active
    ) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Gold Tier - Hardware Policy', 'GOLD', 1, 15.00, 10.00, 15.00, 20.00, 1, true),
    ('10000000-0000-0000-0000-000000000002', 'Gold Tier - Service Policy', 'GOLD', 2, 10.00, 5.00, 10.00, 15.00, 2, true),
    ('10000000-0000-0000-0000-000000000003', 'Silver Tier - Hardware Policy', 'SILVER', 1, 10.00, 5.00, 10.00, 25.00, 3, true),
    ('10000000-0000-0000-0000-000000000004', 'Silver Tier - Service Policy', 'SILVER', 2, 8.00, 4.00, 8.00, 20.00, 4, true),
    ('10000000-0000-0000-0000-000000000005', 'Bronze Tier - General Policy', 'BRONZE', NULL, 5.00, 3.00, 5.00, 30.00, 5, true);
    """)

    # 3. Seed warehouse configs
    print("  -> Seeding warehouse configs...")
    for wh in WAREHOUSES:
        cur.execute("""
        INSERT INTO warehouse_config (id, odoo_warehouse_id, name, location, shipping_cost_weight, is_primary, active)
        VALUES (%s, %s, %s, %s, %s, %s, true)
        """, (str(uuid.uuid5(uuid.NAMESPACE_DNS, f"wh.{wh['id']}")), wh["id"], wh["name"], wh["location"], wh["weight"], wh["primary"]))

    # 4. Insert Deals
    print(f"  -> Inserting {len(data['deals'])} deals...")
    execute_batch(cur, """
    INSERT INTO deal (id, odoo_sale_order_id, odoo_partner_id, owner_user_id, company_id, status, approval_state, health_status, current_risk_score, created_at, updated_at)
    VALUES (%(id)s, %(odoo_sale_order_id)s, %(odoo_partner_id)s, %(owner_user_id)s, %(company_id)s, %(status)s, %(approval_state)s, %(health_status)s, %(current_risk_score)s, %(created_at)s, %(updated_at)s)
    """, data["deals"])

    # 5. Insert Risk Assessments
    print(f"  -> Inserting {len(data['risk_assessments'])} risk assessments...")
    execute_batch(cur, """
    INSERT INTO risk_assessment (id, deal_id, risk_score, severity, decision, trigger_type, policy_version, calculated_at)
    VALUES (%(id)s, %(deal_id)s, %(risk_score)s, %(severity)s, %(decision)s, %(trigger_type)s, %(policy_version)s, %(calculated_at)s)
    """, data["risk_assessments"])

    # 6. Insert Risk Factors
    print(f"  -> Inserting {len(data['risk_factors'])} risk factors...")
    execute_batch(cur, """
    INSERT INTO risk_factor (id, risk_assessment_id, factor_type, source_reference, raw_value, weight, contribution, reason)
    VALUES (%(id)s, %(risk_assessment_id)s, %(factor_type)s, %(source_reference)s, %(raw_value)s, %(weight)s, %(contribution)s, %(reason)s)
    """, data["risk_factors"])

    # 7. Insert Approval Requests
    print(f"  -> Inserting {len(data['approval_requests'])} approval requests...")
    execute_batch(cur, """
    INSERT INTO approval_request (id, deal_id, risk_assessment_id, required_level, sequence, status, requested_at, completed_at, expires_at)
    VALUES (%(id)s, %(deal_id)s, %(risk_assessment_id)s, %(required_level)s, %(sequence)s, %(status)s, %(requested_at)s, %(completed_at)s, %(expires_at)s)
    """, data["approval_requests"])

    # 8. Insert Approval Actions
    print(f"  -> Inserting {len(data['approval_actions'])} approval actions...")
    execute_batch(cur, """
    INSERT INTO approval_action (id, approval_request_id, actor_user_id, action, reason, created_at)
    VALUES (%(id)s, %(approval_request_id)s, %(actor_user_id)s, %(action)s, %(reason)s, %(created_at)s)
    """, data["approval_actions"])

    # 9. Insert Negotiation Requests
    print(f"  -> Inserting {len(data['negotiation_requests'])} negotiation requests...")
    execute_batch(cur, """
    INSERT INTO negotiation_request (id, deal_id, odoo_sale_order_id, customer_partner_id, requested_by, status, message, created_at, processed_at)
    VALUES (%(id)s, %(deal_id)s, %(odoo_sale_order_id)s, %(customer_partner_id)s, %(requested_by)s, %(status)s, %(message)s, %(created_at)s, %(processed_at)s)
    """, data["negotiation_requests"])

    # 10. Insert Negotiation Changes
    print(f"  -> Inserting {len(data['negotiation_changes'])} negotiation changes...")
    execute_batch(cur, """
    INSERT INTO negotiation_change (id, negotiation_request_id, odoo_sale_order_line_id, field_name, old_value, requested_value)
    VALUES (%(id)s, %(negotiation_request_id)s, %(odoo_sale_order_line_id)s, %(field_name)s, %(old_value)s, %(requested_value)s)
    """, data["negotiation_changes"])

    # 11. Insert Fulfillment Plans
    print(f"  -> Inserting {len(data['fulfillment_plans'])} fulfillment plans...")
    execute_batch(cur, """
    INSERT INTO fulfillment_plan (id, deal_id, odoo_sale_order_id, status, estimated_shipments, estimated_shipping_cost, algorithm_version, generated_at)
    VALUES (%(id)s, %(deal_id)s, %(odoo_sale_order_id)s, %(status)s, %(estimated_shipments)s, %(estimated_shipping_cost)s, %(algorithm_version)s, %(generated_at)s)
    """, data["fulfillment_plans"])

    # 12. Insert Fulfillment Plan Lines
    print(f"  -> Inserting {len(data['fulfillment_plan_lines'])} fulfillment plan lines...")
    execute_batch(cur, """
    INSERT INTO fulfillment_plan_line (id, fulfillment_plan_id, odoo_product_id, odoo_warehouse_id, requested_qty, allocated_qty, backorder_qty, shipping_cost)
    VALUES (%(id)s, %(fulfillment_plan_id)s, %(odoo_product_id)s, %(odoo_warehouse_id)s, %(requested_qty)s, %(allocated_qty)s, %(backorder_qty)s, %(shipping_cost)s)
    """, data["fulfillment_plan_lines"])

    # 13. Insert Recommendations
    print(f"  -> Inserting {len(data['recommendations'])} recommendations...")
    execute_batch(cur, """
    INSERT INTO recommendation (id, deal_id, odoo_product_id, recommendation_type, score, margin_delta, reason, source, status, created_at, dismissed_at)
    VALUES (%(id)s, %(deal_id)s, %(odoo_product_id)s, %(recommendation_type)s, %(score)s, %(margin_delta)s, %(reason)s, %(source)s, %(status)s, %(created_at)s, %(dismissed_at)s)
    """, data["recommendations"])

    # 14. Insert Health Snapshots
    print(f"  -> Inserting {len(data['health_snapshots'])} health snapshots...")
    execute_batch(cur, """
    INSERT INTO deal_health_snapshot (id, deal_id, health_status, overall_score, stalled_score, discount_anomaly_score, delivery_risk_score, approval_delay_score, calculated_at)
    VALUES (%(id)s, %(deal_id)s, %(health_status)s, %(overall_score)s, %(stalled_score)s, %(discount_anomaly_score)s, %(delivery_risk_score)s, %(approval_delay_score)s, %(calculated_at)s)
    """, data["health_snapshots"])

    # 15. Insert Audit Events
    print(f"  -> Inserting {len(data['audit_events'])} audit events...")
    execute_batch(cur, """
    INSERT INTO audit_event (id, deal_id, event_type, actor_type, actor_id, entity_type, entity_id, before_state, after_state, reason, metadata, created_at)
    VALUES (%(id)s, %(deal_id)s, %(event_type)s, %(actor_type)s, %(actor_id)s, %(entity_type)s, %(entity_id)s, %(before_state)s, %(after_state)s, %(reason)s, %(metadata)s, %(created_at)s)
    """, data["audit_events"])

    # 16. Insert Subscription Events
    print(f"  -> Inserting {len(data['subscription_events'])} subscription events...")
    execute_batch(cur, """
    INSERT INTO subscription_event (id, deal_id, odoo_subscription_id, event_type, old_plan, new_plan, old_quantity, new_quantity, billing_cycle, proration_days_remaining, proration_total_days, prorated_amount, credit_note_amount, odoo_credit_note_id, reason, created_at)
    VALUES (%(id)s, %(deal_id)s, %(odoo_subscription_id)s, %(event_type)s, %(old_plan)s, %(new_plan)s, %(old_quantity)s, %(new_quantity)s, %(billing_cycle)s, %(proration_days_remaining)s, %(proration_total_days)s, %(prorated_amount)s, %(credit_note_amount)s, %(odoo_credit_note_id)s, %(reason)s, %(created_at)s)
    """, data["subscription_events"])

    conn.commit()
    cur.close()
    conn.close()
    print("  [SUCCESS] All 160 realistic deals successfully persisted into PostgreSQL database!")

def export_sql_file(data):
    sql_path = os.path.join(PROJECT_ROOT, "db", "seed_160_realistic_deals.sql")
    print(f"Exporting standalone SQL file to {sql_path}...")
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("-- =============================================================================\n")
        f.write("-- DealFlow360: 160+ Realistic Multi-Perspective B2B Deals Dataset\n")
        f.write("-- Covers: Sales Rep, Sales Manager, Finance, Customer Portal, and Fulfillment\n")
        f.write("-- =============================================================================\n\n")
        
        # Discount Policies
        f.write("-- 1. Discount Policies\n")
        f.write("""INSERT INTO discount_policy (id, name, customer_tier, product_category_id, max_discount_pct, manager_threshold, finance_threshold, minimum_margin_pct, priority, active) VALUES
('10000000-0000-0000-0000-000000000001', 'Gold Tier - Hardware Policy', 'GOLD', 1, 15.00, 10.00, 15.00, 20.00, 1, true),
('10000000-0000-0000-0000-000000000002', 'Gold Tier - Service Policy', 'GOLD', 2, 10.00, 5.00, 10.00, 15.00, 2, true),
('10000000-0000-0000-0000-000000000003', 'Silver Tier - Hardware Policy', 'SILVER', 1, 10.00, 5.00, 10.00, 25.00, 3, true),
('10000000-0000-0000-0000-000000000004', 'Silver Tier - Service Policy', 'SILVER', 2, 8.00, 4.00, 8.00, 20.00, 4, true),
('10000000-0000-0000-0000-000000000005', 'Bronze Tier - General Policy', 'BRONZE', NULL, 5.00, 3.00, 5.00, 30.00, 5, true)
ON CONFLICT (id) DO NOTHING;\n\n""")

        # Warehouses
        f.write("-- 2. Warehouse Configurations\n")
        for wh in WAREHOUSES:
            wh_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"wh.{wh['id']}"))
            f.write(f"INSERT INTO warehouse_config (id, odoo_warehouse_id, name, location, shipping_cost_weight, is_primary, active) VALUES ('{wh_uuid}', {wh['id']}, '{wh['name']}', '{wh['location']}', {wh['weight']}, {str(wh['primary']).lower()}, true) ON CONFLICT (id) DO NOTHING;\n")
        f.write("\n")

        # Deals
        f.write("-- 3. Canonical Deals (160 Entries)\n")
        for d in data["deals"]:
            f.write(f"INSERT INTO deal (id, odoo_sale_order_id, odoo_partner_id, owner_user_id, company_id, status, approval_state, health_status, current_risk_score, created_at, updated_at) VALUES ('{d['id']}', {d['odoo_sale_order_id']}, {d['odoo_partner_id']}, {d['owner_user_id']}, {d['company_id']}, '{d['status']}', '{d['approval_state']}', '{d['health_status']}', {d['current_risk_score']}, '{d['created_at'].isoformat()}', '{d['updated_at'].isoformat()}') ON CONFLICT (id) DO NOTHING;\n")
        f.write("\n")

        # Risk assessments
        f.write("-- 4. Risk Assessments\n")
        for ra in data["risk_assessments"]:
            f.write(f"INSERT INTO risk_assessment (id, deal_id, risk_score, severity, decision, trigger_type, policy_version, calculated_at) VALUES ('{ra['id']}', '{ra['deal_id']}', {ra['risk_score']}, '{ra['severity']}', '{ra['decision']}', '{ra['trigger_type']}', '{ra['policy_version']}', '{ra['calculated_at'].isoformat()}') ON CONFLICT (id) DO NOTHING;\n")
        f.write("\n")

        # Risk factors
        f.write("-- 5. Risk Factors\n")
        for rf in data["risk_factors"]:
            reason_escaped = rf['reason'].replace("'", "''")
            f.write(f"INSERT INTO risk_factor (id, risk_assessment_id, factor_type, source_reference, raw_value, weight, contribution, reason) VALUES ('{rf['id']}', '{rf['risk_assessment_id']}', '{rf['factor_type']}', '{rf['source_reference']}', {rf['raw_value']}, {rf['weight']}, {rf['contribution']}, '{reason_escaped}') ON CONFLICT (id) DO NOTHING;\n")
        f.write("\n")

        # Approval requests
        f.write("-- 6. Approval Requests\n")
        for ar in data["approval_requests"]:
            comp_val = f"'{ar['completed_at'].isoformat()}'" if ar['completed_at'] else "NULL"
            f.write(f"INSERT INTO approval_request (id, deal_id, risk_assessment_id, required_level, sequence, status, requested_at, completed_at, expires_at) VALUES ('{ar['id']}', '{ar['deal_id']}', '{ar['risk_assessment_id']}', '{ar['required_level']}', {ar['sequence']}, '{ar['status']}', '{ar['requested_at'].isoformat()}', {comp_val}, '{ar['expires_at'].isoformat()}') ON CONFLICT (id) DO NOTHING;\n")
        f.write("\n")

        # Approval actions
        f.write("-- 7. Approval Actions\n")
        for aa in data["approval_actions"]:
            reason_escaped = aa['reason'].replace("'", "''")
            f.write(f"INSERT INTO approval_action (id, approval_request_id, actor_user_id, action, reason, created_at) VALUES ('{aa['id']}', '{aa['approval_request_id']}', {aa['actor_user_id']}, '{aa['action']}', '{reason_escaped}', '{aa['created_at'].isoformat()}') ON CONFLICT (id) DO NOTHING;\n")
        f.write("\n")

        # Customer portal negotiations
        f.write("-- 8. Customer Portal Negotiations\n")
        for nr in data["negotiation_requests"]:
            msg_escaped = nr['message'].replace("'", "''")
            proc_val = f"'{nr['processed_at'].isoformat()}'" if nr['processed_at'] else "NULL"
            f.write(f"INSERT INTO negotiation_request (id, deal_id, odoo_sale_order_id, customer_partner_id, requested_by, status, message, created_at, processed_at) VALUES ('{nr['id']}', '{nr['deal_id']}', {nr['odoo_sale_order_id']}, {nr['customer_partner_id']}, '{nr['requested_by']}', '{nr['status']}', '{msg_escaped}', '{nr['created_at'].isoformat()}', {proc_val}) ON CONFLICT (id) DO NOTHING;\n")
        f.write("\n")

        # Audit events
        f.write("-- 9. Audit Trail Events\n")
        for ae in data["audit_events"]:
            reason_escaped = ae['reason'].replace("'", "''")
            before_escaped = ae['before_state'].replace("'", "''")
            after_escaped = ae['after_state'].replace("'", "''")
            meta_escaped = ae['metadata'].replace("'", "''")
            f.write(f"INSERT INTO audit_event (id, deal_id, event_type, actor_type, actor_id, entity_type, entity_id, before_state, after_state, reason, metadata, created_at) VALUES ('{ae['id']}', '{ae['deal_id']}', '{ae['event_type']}', '{ae['actor_type']}', {ae['actor_id']}, '{ae['entity_type']}', '{ae['entity_id']}', '{before_escaped}'::jsonb, '{after_escaped}'::jsonb, '{reason_escaped}', '{meta_escaped}'::jsonb, '{ae['created_at'].isoformat()}') ON CONFLICT (id) DO NOTHING;\n")
        f.write("\n")

    print(f"  [SUCCESS] SQL file exported successfully to {sql_path}")

def export_frontend_fixtures(data):
    ts_path = os.path.join(PROJECT_ROOT, "frontend", "src", "mocks", "fixtures", "realisticDeals160.ts")
    print(f"Exporting frontend TypeScript fixture to {ts_path}...")
    
    frontend_deals = []
    frontend_approvals = []
    frontend_alerts = []

    for d in data["deals"]:
        # Required level mapping
        if d["current_risk_score"] >= 50.0:
            req_lvl = "FINANCE"
        elif d["current_risk_score"] >= 25.0:
            req_lvl = "MANAGER"
        else:
            req_lvl = "REP_ONLY"

        deal_item = {
            "id": d["id"],
            "reference": d["deal_reference"],
            "odoo_order_name": d["order_name"],
            "partner_name_cache": d["customer_name"],
            "partner_id": d["odoo_partner_id"],
            "status": "PENDING_APPROVAL" if d["approval_state"].startswith("PENDING") else d["status"],
            "approval_state": d["approval_state"],
            "required_level": req_lvl,
            "health_status": d["health_status"],
            "current_risk_score": float(d["current_risk_score"]),
            "current_severity": d["severity"],
            "currency_code": "INR",
            "amount_total_cache": d["amount"],
            "last_activity_at": d["updated_at"].isoformat(),
            "owner": {"id": d["owner_user_id"], "name": d["owner_name"]},
            "version": random.randint(1, 4),
            "scenario_desc": d["scenario_desc"],
            "perspective": d["perspective"],
        }
        frontend_deals.append(deal_item)

        # Approvals list item
        if d["approval_state"] in ("PENDING_MANAGER", "PENDING_FINANCE", "APPROVED", "REJECTED", "RETURNED"):
            approval_item = {
                "id": d["id"],
                "reference": d["deal_reference"],
                "customer": d["customer_name"],
                "risk_score": float(d["current_risk_score"]),
                "severity": d["severity"],
                "stage": "Finance" if d["approval_state"] == "PENDING_FINANCE" or d["current_risk_score"] >= 50.0 else "Sales Manager",
                "assigned_to": "Vikram Finance Officer" if (d["approval_state"] == "PENDING_FINANCE" or d["current_risk_score"] >= 50.0) else "Sunita Rao (Sales Manager North)",
                "status": "PENDING" if d["approval_state"].startswith("PENDING") else d["approval_state"],
                "amount": d["amount"],
                "created_at": d["created_at"].isoformat(),
            }
            frontend_approvals.append(approval_item)

        # Health alerts
        if d["health_status"] in ("STALLED", "AT_RISK", "CRITICAL"):
            alert_item = {
                "id": f"alert_{d['id'][:8]}",
                "deal_id": d["id"],
                "deal_reference": d["deal_reference"],
                "customer_name": d["customer_name"],
                "type": "STALLED_DEAL" if d["health_status"] == "STALLED" else ("DISCOUNT_ANOMALY" if d["current_risk_score"] > 60 else "DELIVERY_SLIPPAGE"),
                "title": d["scenario_desc"],
                "status": "OPEN",
                "severity": d["severity"],
                "health_status": d["health_status"],
                "created_at": d["updated_at"].isoformat(),
            }
            frontend_alerts.append(alert_item)

    with open(ts_path, "w", encoding="utf-8") as f:
        f.write("// Autogenerated 160+ Multi-Perspective Realistic Deals Fixture\n")
        f.write("export const REALISTIC_DEALS_160 = " + json.dumps(frontend_deals, indent=2) + " as any;\n\n")
        f.write("export const REALISTIC_APPROVALS_160 = " + json.dumps(frontend_approvals, indent=2) + " as any;\n\n")
        f.write("export const REALISTIC_ALERTS_160 = " + json.dumps(frontend_alerts, indent=2) + " as any;\n")

    print(f"  [SUCCESS] Frontend TypeScript fixture written to {ts_path}")

if __name__ == "__main__":
    print("=== Starting DealFlow360 160+ Realistic Deals Generation ===")
    data = generate_160_dataset()
    seed_postgres(data)
    export_sql_file(data)
    export_frontend_fixtures(data)
    print("=== All Generation & Seeding Completed Successfully! ===")
