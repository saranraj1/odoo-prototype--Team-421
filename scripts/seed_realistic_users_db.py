# -*- coding: utf-8 -*-
"""Seed realistic internal & customer users into PostgreSQL app_user table."""

import os
import sys
import uuid
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import execute_batch

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://dealflow_user:dealflow_pass@localhost:5432/dealflow360")

USERS = [
    # 1. System Admins
    {"odoo_id": 1, "name": "Devendra Prasad (Principal Enterprise Admin)", "email": "admin@dealflow.test", "role": "ADMIN", "can_lvl1": False, "can_lvl2": False, "portal": False},
    {"odoo_id": 21, "name": "Sneha Banerjee (IT Compliance & Governance Officer)", "email": "sneha.b@dealflow.test", "role": "ADMIN", "can_lvl1": False, "can_lvl2": False, "portal": False},

    # 2. Sales Managers
    {"odoo_id": 3, "name": "Sunita Rao (Regional Sales Director - North)", "email": "manager1@dealflow.test", "role": "SALES_MANAGER", "can_lvl1": True, "can_lvl2": False, "portal": False},
    {"odoo_id": 9, "name": "Arjun Nair (VP Commercial Sales - West)", "email": "arjun.nair@dealflow.test", "role": "SALES_MANAGER", "can_lvl1": True, "can_lvl2": False, "portal": False},
    {"odoo_id": 15, "name": "Rajeshwari Iyer (Commercial Operations Lead - South)", "email": "r.iyer@dealflow.test", "role": "SALES_MANAGER", "can_lvl1": True, "can_lvl2": False, "portal": False},

    # 3. Sales Reps
    {"odoo_id": 4, "name": "Rahul Verma (Enterprise Account Exec)", "email": "rep1@dealflow.test", "role": "SALES_REP", "can_lvl1": False, "can_lvl2": False, "portal": False},
    {"odoo_id": 5, "name": "Priya Sharma (Sr. Commercial Account Exec)", "email": "priya.sharma@dealflow.test", "role": "SALES_REP", "can_lvl1": False, "can_lvl2": False, "portal": False},
    {"odoo_id": 7, "name": "Ananya Sen (Mid-Market Solutions Exec)", "email": "ananya.sen@dealflow.test", "role": "SALES_REP", "can_lvl1": False, "can_lvl2": False, "portal": False},
    {"odoo_id": 8, "name": "Rohan Patel (Hardware Solutions Specialist)", "email": "rohan.patel@dealflow.test", "role": "SALES_REP", "can_lvl1": False, "can_lvl2": False, "portal": False},
    {"odoo_id": 14, "name": "Karan Malhotra (Strategic Accounts Lead)", "email": "karan.m@dealflow.test", "role": "SALES_REP", "can_lvl1": False, "can_lvl2": False, "portal": False},
    {"odoo_id": 16, "name": "Vikramaditya Rao (Public Sector & Enterprise Rep)", "email": "v.rao@dealflow.test", "role": "SALES_REP", "can_lvl1": False, "can_lvl2": False, "portal": False},

    # 4. Finance & Controllers
    {"odoo_id": 2, "name": "Vikram Mehta (Commercial Finance Director)", "email": "finance@dealflow.test", "role": "FINANCE", "can_lvl1": True, "can_lvl2": True, "portal": False},
    {"odoo_id": 10, "name": "Meera Joshi (Senior Pricing & Revenue Controller)", "email": "meera.joshi@dealflow.test", "role": "FINANCE", "can_lvl1": True, "can_lvl2": True, "portal": False},
    {"odoo_id": 18, "name": "Amitabh Sengupta (Head of Deal Desk & Commercial Risk)", "email": "amitabh.s@dealflow.test", "role": "FINANCE", "can_lvl1": True, "can_lvl2": True, "portal": False},

    # 5. Customer Portal Buyers
    {"odoo_id": 101, "name": "David Chen (VP Procurement, Acme Global)", "email": "buyer@acme.test", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 102, "name": "Elena Rostova (Chief Operations, Beta Robotics)", "email": "buyer@beta.test", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 103, "name": "Rajesh Gupta (IT Director, Nova Retail)", "email": "buyer@gamma.test", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 104, "name": "Sandeep Mehta (Strategic Sourcing, Tata Tech)", "email": "sandeep.m@tcs-partner.com", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 105, "name": "Kavita Singhania (VP Infrastructure, Reliance Digital)", "email": "kavita.s@reliancedigital.in", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 106, "name": "Amitabh Roy (Cloud Sourcing Director, Airtel)", "email": "amitabh.roy@airtelcloud.com", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 107, "name": "Pooja Hegde (Procurement Manager, Infosys)", "email": "pooja.h@infosysbpm.com", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 108, "name": "Karthik Raja (VP Engineering, Wipro Cloud)", "email": "karthik.raja@wiprocloud.com", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 109, "name": "Vikas Deshmukh (Supply Chain VP, Mahindra Auto)", "email": "vikas.d@mahindraauto.com", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 110, "name": "Harish Kulkarni (Procurement Head, L&T)", "email": "h.kulkarni@lntecc.com", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 111, "name": "Marcus Thorne (COO, Delta Systems)", "email": "marcus@deltasystems.com", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 114, "name": "Dr. Sameer Kapoor (Director, Omega Medical)", "email": "sameer@omegamed.in", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 116, "name": "Nathaniel Reed (Security Lead, Theta Cyber)", "email": "nreed@thetacyber.com", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 118, "name": "Nisha Reddy (CIO, Apollo Health)", "email": "nisha.reddy@apollohealth.org", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 119, "name": "Praveen Nair (Fintech Lead, Bajaj Finserv)", "email": "praveen.nair@bajajfinserv.in", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 123, "name": "Dr. Sarah Lin (Research Lead, NexGen AI)", "email": "slin@nexgenai.ai", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
    {"odoo_id": 124, "name": "Gaurav Malhotra (VP Operations, OmniChannel Retail)", "email": "gaurav@omnichannel.in", "role": "CUSTOMER", "can_lvl1": False, "can_lvl2": False, "portal": True},
]

def seed_users():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    print("Seeding realistic users into PostgreSQL app_user table...")
    cur.execute("TRUNCATE TABLE app_user CASCADE;")
    now = datetime.now(timezone.utc)
    
    rows = []
    for u in USERS:
        u_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"user.{u['odoo_id']}"))
        rows.append({
            "id": u_uuid,
            "odoo_user_id": u["odoo_id"],
            "name": u["name"],
            "email": u["email"],
            "role": u["role"],
            "can_approve_level1": u["can_lvl1"],
            "can_approve_level2": u["can_lvl2"],
            "has_portal_access": u["portal"],
            "company_id": 1,
            "active": True,
            "created_at": now,
            "updated_at": now,
        })

    execute_batch(cur, """
    INSERT INTO app_user (id, odoo_user_id, name, email, role, can_approve_level1, can_approve_level2, has_portal_access, company_id, active, created_at, updated_at)
    VALUES (%(id)s, %(odoo_user_id)s, %(name)s, %(email)s, %(role)s, %(can_approve_level1)s, %(can_approve_level2)s, %(has_portal_access)s, %(company_id)s, %(active)s, %(created_at)s, %(updated_at)s)
    """, rows)

    conn.commit()
    cur.close()
    conn.close()
    print(f"  [SUCCESS] {len(rows)} realistic users inserted into app_user table!")

if __name__ == "__main__":
    seed_users()
