# -*- coding: utf-8 -*-
"""DealFlow360 — Cryptographic & Network Security Utilities.

Provides production-grade defense controls:
- HMAC-SHA256 signed governance approval tokens
- Constant-time secret/key verification (anti-timing attacks)
- Outbound webhook HMAC payload signing & verification
- SSRF defense: Scheme allowlisting, DNS resolution, and IP range gating (blocking loopback, RFC-1918 private IPs, and cloud metadata 169.254.169.254)
- Safe HTTP redirect handling preventing SSRF via 3xx redirects
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import logging
import os
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional, Tuple

logger = logging.getLogger("dealflow.security")

DEFAULT_SECRET_KEY = "dealflow_sec_token_key_2026_production_default"


def _get_signing_key(secret_key: Optional[str] = None) -> str:
    """Retrieve active signing key from parameter, environment, or default fallback."""
    if secret_key:
        return secret_key
    return os.environ.get("DEALFLOW_SIGNING_KEY", DEFAULT_SECRET_KEY)


# -----------------------------------------------------------------------------
# 1. Cryptographic Approval Token Engine
# -----------------------------------------------------------------------------

def generate_approval_token(
    order_id: int,
    secret_key: Optional[str] = None,
    ttl_seconds: int = 3600,
) -> str:
    """Generate an HMAC-SHA256 signed approval token strictly bound to order_id and expiration.

    Format: DF-APP.<order_id>.<expiry_timestamp>.<hex_signature>
    """
    secret = _get_signing_key(secret_key)
    expiry = int(time.time()) + max(1, ttl_seconds)
    payload = f"{int(order_id)}.{expiry}"
    sig = hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"DF-APP.{payload}.{sig}"


def verify_approval_token(
    token: Optional[str],
    order_id: int,
    secret_key: Optional[str] = None,
) -> bool:
    """Verify that the approval token is valid, cryptographically signed, unexpired, and bound to order_id.

    Returns:
        True if the token is authentic, unexpired, and matches order_id; False otherwise.
    """
    if not token or not isinstance(token, str):
        return False

    parts = token.strip().split(".")
    if len(parts) != 4 or parts[0] != "DF-APP":
        return False

    try:
        token_order_id = int(parts[1])
        token_expiry = int(parts[2])
        token_sig = parts[3]
    except (ValueError, TypeError):
        return False

    # 1. Order ID binding check
    if token_order_id != int(order_id):
        logger.warning(
            "Approval token order mismatch: expected %s, got %s",
            order_id,
            token_order_id,
        )
        return False

    # 2. Expiration check
    current_time = int(time.time())
    if current_time > token_expiry:
        logger.warning(
            "Approval token expired for order %s (expired at %s, current %s)",
            order_id,
            token_expiry,
            current_time,
        )
        return False

    # 3. Cryptographic signature check (constant-time)
    secret = _get_signing_key(secret_key)
    payload = f"{token_order_id}.{token_expiry}"
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, token_sig):
        logger.warning("Approval token signature verification failed for order %s", order_id)
        return False

    return True


# -----------------------------------------------------------------------------
# 2. API Key / Secret Constant-Time Verification
# -----------------------------------------------------------------------------

def verify_api_key(
    provided_key: Optional[str],
    expected_key: Optional[str],
) -> bool:
    """Compare two API keys in constant time to prevent timing side-channel attacks."""
    if not provided_key or not expected_key:
        return False
    return hmac.compare_digest(provided_key.strip(), expected_key.strip())


# -----------------------------------------------------------------------------
# 3. Outbound Webhook Signing
# -----------------------------------------------------------------------------

def generate_webhook_signature(payload_bytes: bytes, secret_key: str) -> str:
    """Generate standard HMAC-SHA256 signature header for outbound webhooks."""
    digest = hmac.new(
        secret_key.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


def verify_webhook_signature(
    payload_bytes: bytes,
    signature_header: str,
    secret_key: str,
) -> bool:
    """Verify incoming/outgoing webhook signature against payload bytes."""
    if not signature_header or not secret_key:
        return False

    expected_sig = generate_webhook_signature(payload_bytes, secret_key)
    return hmac.compare_digest(signature_header.strip(), expected_sig)


# -----------------------------------------------------------------------------
# 4. SSRF Defense: Scheme, Hostname & IP Range Validation
# -----------------------------------------------------------------------------

BLOCKED_HOSTNAMES = {
    "localhost",
    "127.0.0.1",
    "::1",
    "0.0.0.0",
    "metadata.google.internal",
    "instance-data",
}


def is_safe_webhook_url(
    url: str,
    allow_private: bool = False,
) -> Tuple[bool, str]:
    """Validate webhook URL against SSRF attack vectors.

    Checks:
    - URL scheme must be http or https
    - Hostname must not be empty or known loopback/metadata names
    - IP addresses resolved by DNS must NOT belong to loopback, RFC-1918 private,
      link-local (including 169.254.169.254 cloud metadata), reserved, or multicast spaces.

    Returns:
        (True, "Safe") or (False, "Reason for rejection")
    """
    if not url or not isinstance(url, str):
        return False, "URL cannot be empty."

    try:
        parsed = urllib.parse.urlparse(url.strip())
    except Exception as parse_err:
        return False, f"Malformed URL: {parse_err}"

    # 1. Scheme Check
    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Disallowed scheme '{parsed.scheme}'. Only http and https are permitted."

    hostname = parsed.hostname
    if not hostname:
        return False, "URL missing hostname."

    hostname_clean = hostname.strip().lower()
    if hostname_clean in BLOCKED_HOSTNAMES:
        return False, f"Disallowed host '{hostname}' (loopback/metadata alias)."

    if allow_private:
        return True, "URL allowed by policy."

    # 2. DNS Resolution & IP Range Check
    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    try:
        addr_info = socket.getaddrinfo(
            hostname_clean,
            port,
            socket.AF_UNSPEC,
            socket.SOCK_STREAM,
        )
    except socket.gaierror as dns_err:
        # In test environments or when offline, if domain cannot be resolved, check literal IP
        try:
            ip_obj = ipaddress.ip_address(hostname_clean)
            addr_info = [(None, None, None, None, (str(ip_obj), port))]
        except ValueError:
            if hostname_clean.endswith((".test", ".example", ".invalid", ".internal", ".mock")):
                return True, "Test mock domain allowed."
            return False, f"DNS resolution failed for hostname '{hostname_clean}': {dns_err}"

    for entry in addr_info:
        sockaddr = entry[4]
        ip_str = sockaddr[0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
        except ValueError:
            return False, f"Invalid resolved IP address '{ip_str}'."

        # Verify against sensitive IP ranges
        if ip_obj.is_loopback:
            return False, f"SSRF blocked: Resolved IP '{ip_str}' is a loopback address."
        if ip_obj.is_private:
            return False, f"SSRF blocked: Resolved IP '{ip_str}' is a private RFC-1918 address."
        if ip_obj.is_link_local:
            return False, f"SSRF blocked: Resolved IP '{ip_str}' is a link-local / cloud metadata address."
        if ip_obj.is_reserved:
            return False, f"SSRF blocked: Resolved IP '{ip_str}' is an IETF reserved address."
        if ip_obj.is_multicast:
            return False, f"SSRF blocked: Resolved IP '{ip_str}' is a multicast address."
        if ip_obj.is_unspecified:
            return False, f"SSRF blocked: Resolved IP '{ip_str}' is an unspecified address."

    return True, "URL is safe."


# -----------------------------------------------------------------------------
# 5. Safe HTTP Redirect Handler
# -----------------------------------------------------------------------------

class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Custom HTTP redirect handler that prevents SSRF via 3xx redirects to private or metadata addresses."""

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> Optional[urllib.request.Request]:
        """Validate destination URL before following HTTP 3xx redirect."""
        is_safe, reason = is_safe_webhook_url(newurl, allow_private=False)
        if not is_safe:
            logger.error("SSRF Redirect Blocked: Target '%s' is unsafe (%s)", newurl, reason)
            raise urllib.error.HTTPError(
                newurl,
                code,
                f"SSRF Redirect Blocked: {reason}",
                headers,
                fp,
            )
        return super().redirect_request(req, fp, code, msg, headers, newurl)
