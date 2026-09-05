#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DealFlow360 — Backend Runner
============================
Starts the FastAPI Decision Engine Gateway on http://127.0.0.1:8000

Usage:
    python run_backend.py
"""

import os
import sys
from pathlib import Path

# Ensure root directory is in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

def main():
    try:
        import uvicorn
    except ImportError:
        print("[ERROR] 'uvicorn' is not installed.")
        print("Install it with: pip install uvicorn[standard]")
        sys.exit(1)

    print("=" * 60)
    print("  DEALFLOW360 — FASTAPI DECISION ENGINE GATEWAY")
    print("=" * 60)
    print("  -> Base URL:  http://127.0.0.1:8000")
    print("  -> Swagger:   http://127.0.0.1:8000/docs")
    print("  -> Health:    http://127.0.0.1:8000/health")
    print("=" * 60)
    print("Starting uvicorn server with auto-reload...\n")

    uvicorn.run(
        "backend.app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )

if __name__ == "__main__":
    main()
