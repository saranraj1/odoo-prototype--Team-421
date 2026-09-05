# -*- coding: utf-8 -*-
"""
DealFlow360 Seed Data Loader
Author: Person 1 (DB Architect)
Purpose: Populates the 4 deterministic demo scenarios into DealFlow PostgreSQL DB.
"""

import os
import sys

# Try importing connection manager
try:
    from db.connection import get_db_cursor
    HAS_CONN = True
except ImportError:
    HAS_CONN = False

def run_seed():
    print("=== DealFlow360 Database Seed Loader ===")
    seed_sql_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed.sql")
    if not os.path.exists(seed_sql_path):
        print(f"[ERROR] Seed SQL file not found at {seed_sql_path}")
        return False

    with open(seed_sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    if not HAS_CONN:
        print("[INFO] Standalone execution: Read seed.sql successfully.")
        print("To apply to PostgreSQL, ensure DATABASE_URL is set and psycopg2 is installed.")
        return True

    try:
        with get_db_cursor(commit=True) as cur:
            cur.execute(sql_content)
        print("  ✓ Seed data successfully inserted into PostgreSQL!")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to execute seed data: {e}")
        return False

if __name__ == "__main__":
    success = run_seed()
    sys.exit(0 if success else 1)
