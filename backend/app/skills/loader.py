"""Skill loader — scans skills/ directory, parses SKILL.md, auto-registers handlers."""

from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path
from typing import Any

import yaml
from loguru import logger

from ..agent.skills.base import (
    BaseSkill,
    SkillCategory,
    SkillResult,
    skill_registry,
)


def _parse_frontmatter(path: Path) -> dict[str, Any]:
    """Parse YAML frontmatter from a SKILL.md file."""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}
    # Extract block between first and second ---
    end = text.find("---", 3)
    if end == -1:
        return {}
    block = text[3:end].strip()
    return yaml.safe_load(block) or {}


class _DirectorySkill(BaseSkill):
    """A skill discovered from skills/<name>/ directory."""

    def __init__(self, name: str, meta: dict[str, Any], handler_func):
        self.name = name
        self.category = SkillCategory(meta.get("category", "market_data"))
        self.description = meta.get("description", "")
        self._meta = meta
        self._handler = handler_func

    async def execute(self, **kwargs) -> SkillResult:
        """Delegate to the handler.py :run function."""
        from ..agent.skills.base import SkillResult
        result = await self._handler(ctx=None, inputs=kwargs)
        # If handler already returns SkillResult, use it directly
        if isinstance(result, SkillResult):
            return result
        # Otherwise wrap
        return SkillResult(success=True, data=result)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "category": self.category.value,
            "description": self.description,
            "risk_class": self._meta.get("risk_class", "read_only"),
        }


def _import_handler(handler_path: Path):
    """Import the run function from handler.py."""
    module_name = f"_skill_handler_{hash(str(handler_path))}"
    spec = importlib.util.spec_from_file_location(module_name, handler_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load handler: {handler_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    if not hasattr(module, "run"):
        raise AttributeError(f"Handler {handler_path} missing 'run' function")
    return module.run


def scan_and_register(project_root: Path | None = None) -> int:
    """Scan skills/ directory and register found skills.

    Directory layout: skills/<skill-name>/SKILL.md + handler.py

    Returns number of skills registered.
    """
    if project_root is None:
        # Default: two levels up from backend/app/skills/loader.py
        project_root = Path(__file__).resolve().parent.parent.parent.parent

    skills_dir = project_root / "skills"
    if not skills_dir.is_dir():
        logger.warning(f"Skills directory not found: {skills_dir}")
        return 0

    count = 0
    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir():
            continue
        skill_md = entry / "SKILL.md"
        handler_py = entry / "handler.py"

        if not skill_md.exists():
            logger.warning(f"Skill {entry.name}: missing SKILL.md, skipping")
            continue
        if not handler_py.exists():
            logger.warning(f"Skill {entry.name}: missing handler.py, skipping")
            continue

        try:
            meta = _parse_frontmatter(skill_md)
            name = meta.get("name", entry.name)
            handler_func = _import_handler(handler_py)
            skill = _DirectorySkill(name=name, meta=meta, handler_func=handler_func)
            skill_registry.register(skill)
            count += 1
        except Exception as e:
            logger.error(f"Failed to load skill {entry.name}: {e}")

    logger.info(f"Loaded {count} skills from {skills_dir}")
    return count
