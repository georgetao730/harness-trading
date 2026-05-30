"""Skeleton smoke test — keeps CI green until real tests arrive in Sprint 1."""
from __future__ import annotations

import sys


def test_python_is_modern_enough() -> None:
    """Sprint 0 baseline: refuse to run on Python <3.11 per ADR-0001."""
    assert sys.version_info >= (3, 11), f"need py3.11+, got {sys.version_info}"


def test_app_package_importable() -> None:
    """Sanity check: `app` is a Python package present on sys.path."""
    import app  # noqa: F401  (skeleton import; actual modules land in Sprint 1)
