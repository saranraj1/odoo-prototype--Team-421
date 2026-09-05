#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DealFlow360 — Local Standalone Runner (No Docker Required)
=========================================================
Runs the complete DealFlow360 platform natively without relying on Docker:
1. FastAPI Decision Engine Gateway (Port 8000 & 8069)
2. Vite React Frontend Development Server (Port 5173)

Usage:
    python run_local.py
"""

import os
import sys
import subprocess
import time
import signal
import socket
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

def is_port_in_use(port: int) -> bool:
    """Check if a local TCP port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0

def print_banner():
    banner = """
================================================================================
                    DEALFLOW360 — LOCAL RUNNER (NO DOCKER)
================================================================================
  Core Doctrine:
    - Odoo owns transactions.
    - DealFlow owns decisions.
    - Deal Guardian governs deal state.

  Services Starting:
    [1] FastAPI Decision Engine Gateway:  http://localhost:8000
    [2] Odoo Compatible REST Gateway:    http://localhost:8000/api/dealflow/health
    [3] DealFlow360 Frontend Web App:     http://localhost:5173
================================================================================
"""
    print(banner)

def main():
    print_banner()

    # Verify python packages
    try:
        import uvicorn
        import fastapi
        import pydantic
    except ImportError as e:
        print(f"[ERROR] Missing Python dependency: {e}")
        print("Please install requirements: pip install -r requirements.txt")
        sys.exit(1)

    # Start FastAPI server process
    print("[1/2] Starting Decision Engine Gateway on http://localhost:8000 ...")
    api_cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "backend.app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ]
    backend_proc = subprocess.Popen(
        api_cmd,
        cwd=str(BASE_DIR),
        shell=False,
    )

    # Start Vite Frontend process
    print("[2/2] Starting Vite Frontend on http://localhost:5173 ...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=str(FRONTEND_DIR),
        shell=True if sys.platform == "win32" else False,
    )

    print("\n[READY] DealFlow360 is live and running!")
    print("  -> Open Web UI: http://localhost:5173")
    print("  -> Interactive API Docs: http://localhost:8000/docs")
    print("  -> Press CTRL+C to stop all services.\n")

    def handle_signal(sig, frame):
        print("\n[STOPPING] Shutting down DealFlow360 processes...")
        backend_proc.terminate()
        frontend_proc.terminate()
        backend_proc.wait(timeout=5)
        frontend_proc.wait(timeout=5)
        print("[DONE] All services stopped cleanly.")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_signal)

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print("[WARNING] Backend process exited unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("[WARNING] Frontend process exited unexpectedly.")
                break
    except KeyboardInterrupt:
        handle_signal(None, None)

if __name__ == "__main__":
    main()
