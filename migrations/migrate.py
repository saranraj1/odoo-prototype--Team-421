# -*- coding: utf-8 -*-
"""
DealFlow360 Migration Runner
Author: Person 1 (DB Architect)
Purpose: Executes versioned database migrations deterministically for the entire team.
"""

import os
import glob
import sys
import hashlib
from datetime import datetime

# Try importing psycopg2 or psycopg3
try:
    import psycopg2
    from psycopg2 import sql
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Fallback construction if individual DEALFLOW_DB_* vars are defined
_db_user = os.getenv("DEALFLOW_DB_USER", "dealflow_user")
_db_pass = os.getenv("DEALFLOW_DB_PASSWORD", "dealflow_pass")
_db_host = os.getenv("DEALFLOW_DB_HOST", "localhost")
_db_port = os.getenv("DEALFLOW_DB_PORT", "5432")
_db_name = os.getenv("DEALFLOW_DB_NAME", "dealflow360")

_default_url = f"postgresql://{_db_user}:{_db_pass}@{_db_host}:{_db_port}/{_db_name}"
DATABASE_URL = os.getenv("DATABASE_URL", _default_url)

def get_connection():
    if not HAS_POSTGRES:
        print("[MIGRATION WARNING] psycopg2 not installed in this Python environment. Please install psycopg2-binary.")
        return None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        return conn
    except Exception as e:
        print(f"[MIGRATION ERROR] Could not connect to PostgreSQL at {DATABASE_URL}: {e}")
        return None

def init_migrations_table(conn):
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(128) PRIMARY KEY,
                checksum VARCHAR(64) NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
    conn.commit()

def compute_checksum(filepath):
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        hasher.update(f.read())
    return hasher.hexdigest()

def get_applied_migrations(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT version, checksum FROM schema_migrations ORDER BY version ASC;")
        return {row[0]: row[1] for row in cur.fetchall()}

def run_migrations():
    print(f"=== DealFlow360 Database Migration Runner ===")
    conn = get_connection()
    if not conn:
        print("[ABORT] Database connection unavailable.")
        return False

    init_migrations_table(conn)
    applied = get_applied_migrations(conn)

    migration_dir = os.path.dirname(os.path.abspath(__file__))
    sql_files = sorted(glob.glob(os.path.join(migration_dir, "*.sql")))

    if not sql_files:
        print("No migration files found in migrations/ directory.")
        return True

    print(f"Discovered {len(sql_files)} migration files. {len(applied)} already applied.")

    for filepath in sql_files:
        version = os.path.basename(filepath)
        checksum = compute_checksum(filepath)

        if version in applied:
            if applied[version] != checksum:
                print(f"[WARNING] Checksum mismatch for already applied migration {version}!")
            else:
                print(f"  ✓ {version} (Already applied)")
            continue

        print(f"  → Applying {version}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        try:
            with conn.cursor() as cur:
                cur.execute(sql_content)
                cur.execute(
                    "INSERT INTO schema_migrations (version, checksum) VALUES (%s, %s);",
                    (version, checksum)
                )
            conn.commit()
            print(f"  ✓ Successfully applied {version}")
        except Exception as err:
            conn.rollback()
            print(f"[ERROR] Failed applying migration {version}: {err}")
            return False

    print("=== All migrations up to date ===")
    return True

if __name__ == "__main__":
    success = run_migrations()
    sys.exit(0 if success else 1)
