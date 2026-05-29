"""HarnessToken — HMAC-signed safety token for broker operations.

Every order submitted through a BrokerChannel must carry a HarnessToken.
The token is an HMAC-signed payload that binds the operation to the gateway
session, preventing replay and unauthorized execution.

Format: payload + "." + signature
  payload  = urlsafe_base64(json({action, symbol, quantity, ts, ...}))
  signature = hmac_sha256(secret_key, payload)
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path


def _secret_key_path() -> Path:
    base = os.environ.get("HARNESS_TRADING_HOME", str(Path.home() / ".harness-trading"))
    return Path(base) / "secret.key"


def _read_secret_key() -> bytes:
    path = _secret_key_path()
    if not path.exists():
        raise FileNotFoundError(f"secret.key not found at {path}. Run 'harness-trading onboard' first.")
    return bytes.fromhex(path.read_text(encoding="utf-8").strip())


def generate_harness_token(data: dict) -> str:
    """Sign a broker operation payload and return the HarnessToken string.

    Example:
        token = generate_harness_token({
            "action": "submit",
            "symbol": "600519",
            "quantity": 100,
            "ts": int(time.time()),
            "nonce": secrets.token_hex(4),
        })
    """
    payload_bytes = json.dumps(data, separators=(",", ":")).encode()
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).rstrip(b"=").decode()

    key = _read_secret_key()
    sig = hmac.new(key, payload_b64.encode(), hashlib.sha256).hexdigest()

    return f"{payload_b64}.{sig}"


def verify_harness_token(token: str) -> dict:
    """Verify a HarnessToken and return the decoded payload dict.

    Raises ValueError if signature is invalid or token is malformed.

    Constant-time comparison is used for signature verification.
    """
    if "." not in token:
        raise ValueError("Malformed HarnessToken: missing signature separator")

    payload_b64, provided_sig = token.rsplit(".", 1)

    key = _read_secret_key()
    expected_sig = hmac.new(key, payload_b64.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig.encode(), provided_sig.encode()):
        raise ValueError("Invalid HarnessToken signature")

    # Decode payload (add padding back)
    padding = 4 - len(payload_b64) % 4
    if padding != 4:
        payload_b64 += "=" * padding
    payload_bytes = base64.urlsafe_b64decode(payload_b64)
    return json.loads(payload_bytes)


def verify_harness_token_or_raise(token: str, expected_action: str | None = None) -> dict:
    """Verify and optionally check the action field. Raises on failure."""
    payload = verify_harness_token(token)

    # Reject expired tokens (> 60 seconds)
    now = int(time.time())
    ts = payload.get("ts", 0)
    if now - ts > 60:
        raise ValueError("HarnessToken expired")

    if expected_action and payload.get("action") != expected_action:
        raise ValueError(f"HarnessToken action mismatch: expected {expected_action}, got {payload.get('action')}")

    return payload
