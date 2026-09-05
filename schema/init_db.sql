-- =========================================================
-- DealFlow360 Initial Database & Role Setup
-- Run as superuser (e.g. postgres):
-- psql -U postgres -f schema/init_db.sql
-- =========================================================

DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE rolname = 'dealflow_user'
   ) THEN
      CREATE ROLE dealflow_user WITH LOGIN PASSWORD 'dealflow_pass' CREATEDB SUPERUSER;
   ELSE
      ALTER ROLE dealflow_user WITH PASSWORD 'dealflow_pass' LOGIN CREATEDB SUPERUSER;
   END IF;
END
$do$;

SELECT 'CREATE DATABASE dealflow360 OWNER dealflow_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dealflow360')\gexec

GRANT ALL PRIVILEGES ON DATABASE dealflow360 TO dealflow_user;
