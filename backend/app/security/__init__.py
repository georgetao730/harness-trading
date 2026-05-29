"""Token authentication — constant-time compare + auth.json reader.

Security model: single long-lived token stored in ~/.harness-trading/auth.json.
See ADR-0005 for rationale (no rotate, local-first single-user).
"""

import hmac
import json
import os
from pathlib import Path
from typing import Optional


def _auth_json_path() -> Path:
    """Resolve auth.json path."""
    base = os.environ.get("HARNESS_TRADING_HOME", str(Path.home() / ".harness-trading"))
    return Path(base) / "auth.json"


def read_token() -> Optional[str]:
    """Read the gateway token from ~/.harness-trading/auth.json."""
    path = _auth_json_path()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("token")
    except (json.JSONDecodeError, KeyError, OSError):
        return None


def verify_token(provided: str) -> bool:
    """Constant-time comparison of provided token against stored token.

    Uses hmac.compare_digest to prevent timing side-channels.
    Returns True if the token matches, False otherwise (including missing file).
    """
    stored = read_token()
    if stored is None:
        return False
    if not provided:
        return False
    return hmac.compare_digest(stored.encode(), provided.encode())
