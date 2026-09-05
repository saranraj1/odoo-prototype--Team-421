# -*- coding: utf-8 -*-
"""
DealFlow360 Local PostgreSQL Setup Helper
Creates dealflow_user, dealflow360 database, and runs all migrations.
"""
import sys
import getpass
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def setup():
    print("=== DealFlow360 Local PostgreSQL Initializer ===")
    
    # Check if a postgres password was passed as argument or prompt
    if len(sys.argv) > 1:
        admin_pass = sys.argv[1]
    else:
        print("Please enter your local PostgreSQL 'postgres' superuser password:")
        admin_pass = getpass.getpass("Password: ")
        
    admin_user = "postgres"
    host = "localhost"
    port = 5432
    
    print(f"Connecting to PostgreSQL as '{admin_user}'...")
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            user=admin_user,
            password=admin_pass,
            dbname="postgres",
            connect_timeout=5
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    except Exception as e:
        print(f"\n[ERROR] Could not connect as '{admin_user}': {e}")
        return False
        
    with conn.cursor() as cur:
        # 1. Create or update role
        print("Ensuring role 'dealflow_user' exists...")
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = 'dealflow_user';")
        if not cur.fetchone():
            cur.execute("CREATE ROLE dealflow_user WITH LOGIN PASSWORD 'dealflow_pass' CREATEDB SUPERUSER;")
            print("  Created role 'dealflow_user' with password 'dealflow_pass'.")
        else:
            cur.execute("ALTER ROLE dealflow_user WITH LOGIN PASSWORD 'dealflow_pass' CREATEDB SUPERUSER;")
            print("  Updated role 'dealflow_user' password to 'dealflow_pass'.")
            
        # 2. Create database if not exists
        print("Ensuring database 'dealflow360' exists...")
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'dealflow360';")
        if not cur.fetchone():
            cur.execute("CREATE DATABASE dealflow360 OWNER dealflow_user;")
            print("  Created database 'dealflow360' owned by 'dealflow_user'.")
        else:
            print("  Database 'dealflow360' already exists.")
            
        cur.execute("GRANT ALL PRIVILEGES ON DATABASE dealflow360 TO dealflow_user;")
        
    conn.close()
    print("\nDatabase and user successfully initialized!\n")
    
    # Run migrations
    from migrations.migrate import run_migrations
    return run_migrations()

if __name__ == "__main__":
    success = setup()
    sys.exit(0 if success else 1)
