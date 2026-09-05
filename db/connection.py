# -*- coding: utf-8 -*-
"""
DealFlow360 Database Connection & Pool Manager
Author: Person 1 (DB Architect)
Purpose: Handles thread-safe connection pooling, transactions, and session context management.
"""

import os
import contextlib
from typing import Generator, Any

try:
    import psycopg2
    from psycopg2 import pool
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

import time

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://dealflow_user:dealflow_pass@localhost:5432/dealflow360")
MIN_CONNECTIONS = int(os.getenv("DB_MIN_CONNECTIONS", "2"))
MAX_CONNECTIONS = int(os.getenv("DB_MAX_CONNECTIONS", "10"))
DB_CONNECT_TIMEOUT = int(os.getenv("DB_CONNECT_TIMEOUT", "2"))

_connection_pool = None
_last_pool_fail_time = 0.0
_POOL_RETRY_INTERVAL = 10.0  # seconds between reconnection attempts when DB is unreachable

def init_connection_pool():
    global _connection_pool, _last_pool_fail_time
    if not HAS_PSYCOPG2:
        return None
    if _connection_pool is None:
        now = time.time()
        if now - _last_pool_fail_time < _POOL_RETRY_INTERVAL:
            return None
        try:
            dsn = DATABASE_URL
            if "connect_timeout=" not in dsn and "?" not in dsn:
                dsn = f"{dsn}?connect_timeout={DB_CONNECT_TIMEOUT}"
            elif "connect_timeout=" not in dsn:
                dsn = f"{dsn}&connect_timeout={DB_CONNECT_TIMEOUT}"

            _connection_pool = pool.ThreadedConnectionPool(
                minconn=MIN_CONNECTIONS,
                maxconn=MAX_CONNECTIONS,
                dsn=dsn,
                cursor_factory=RealDictCursor
            )
        except Exception as e:
            _last_pool_fail_time = now
            print(f"[DB_CONNECTION_ERROR] Failed to initialize ThreadedConnectionPool: {e}")
            _connection_pool = None
    return _connection_pool

def close_connection_pool():
    global _connection_pool
    if _connection_pool:
        _connection_pool.closeall()
        _connection_pool = None

@contextlib.contextmanager
def get_db_connection() -> Generator[Any, None, None]:
    """Context manager yielding a PostgreSQL connection from the pool."""
    pool_instance = init_connection_pool()
    if not pool_instance:
        raise RuntimeError("Database connection pool is not initialized or psycopg2 is missing.")
    
    conn = pool_instance.getconn()
    try:
        yield conn
    finally:
        pool_instance.putconn(conn)

@contextlib.contextmanager
def get_db_cursor(commit: bool = False) -> Generator[Any, None, None]:
    """Context manager yielding a database cursor with automatic commit/rollback."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            try:
                yield cur
                if commit:
                    conn.commit()
            except Exception:
                conn.rollback()
                raise
