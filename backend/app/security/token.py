"""Token issuance — generate and persist gateway tokens.

Used by the Node CLI `harness-trading onboard` to bootstrap the auth file.
"""

import json
import os
import secrets
from pathlib import Path


def generate_token() -> str:
    """Generate a 256-bit (32-byte) hex token."""
    return secrets.token_hex(32)


def write_auth_json(token: str, home_dir: str | None = None) -> Path:
    """Write auth.json with the given token.

    Creates ~/.harness-trading/auth.json with 0600 permissions.
    Returns the written file path.
    """
    import time

    base = Path(home_dir) if home_dir else Path(os.environ.get(
        "HARNESS_TRADING_HOME",
        str(Path.home() / ".harness-trading"),
    ))
    base.mkdir(parents=True, exist_ok=True)

    payload = {
        "token": token,
        "created_at": int(time.time()),
    }

    auth_path = base / "auth.json"
    # Write atomically: temp file + rename
    tmp_path = auth_path.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp_path.chmod(0o600)
    tmp_path.rename(auth_path)

    # Ensure directory perms too
    base.chmod(0o700)

    return auth_path


def write_secret_key(home_dir: str | None = None) -> Path:
    """Generate and persist a secret.key for HarnessToken HMAC signing.

    Writes 32 random bytes as hex to ~/.harness-trading/secret.key (0600).
    Returns the written file path.
    """
    base = Path(home_dir) if home_dir else Path(os.environ.get(
        "HARNESS_TRADING_HOME",
        str(Path.home() / ".harness-trading"),
    ))
    base.mkdir(parents=True, exist_ok=True)

    key = secrets.token_hex(32)
    key_path = base / "secret.key"
    key_path.write_text(key, encoding="utf-8")
    key_path.chmod(0o600)
    base.chmod(0o700)

    return key_path
