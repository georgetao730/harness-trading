"""Agent role loader — scan agents/*.md and register roles."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from loguru import logger


@dataclass
class AgentRole:
    name: str
    display_name: str
    description: str
    allowed_skills: list[str] = field(default_factory=list)
    allowed_channels: list[str] = field(default_factory=list)
    llm_routing: dict[str, str] = field(default_factory=dict)
    system_prompt: str = ""
    safety: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "allowed_skills": self.allowed_skills,
            "allowed_channels": self.allowed_channels,
            "llm_routing": self.llm_routing,
            "safety": self.safety,
        }


class AgentRegistry:
    """Holds all registered agent roles."""

    def __init__(self) -> None:
        self._agents: dict[str, AgentRole] = {}

    def register(self, role: AgentRole) -> None:
        self._agents[role.name] = role
        logger.info(f"Registered agent role: {role.name}")

    def get(self, name: str) -> AgentRole | None:
        return self._agents.get(name)

    def list_all(self) -> dict[str, str]:
        return {k: v.display_name for k, v in self._agents.items()}

    def scan(self, root: Path) -> int:
        """Scan agents/*.md and register all."""
        agent_dir = root / "agents"
        if not agent_dir.is_dir():
            logger.warning(f"Agents directory not found: {agent_dir}")
            return 0

        count = 0
        for mdfile in sorted(agent_dir.glob("*.md")):
            try:
                role = _load_agent_role(mdfile)
                self.register(role)
                count += 1
            except Exception as e:
                logger.error(f"Failed to load agent {mdfile.name}: {e}")
        return count


def _load_agent_role(path: Path) -> AgentRole:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        raise ValueError(f"Agent {path} missing frontmatter")
    end = text.find("---", 3)
    if end == -1:
        raise ValueError(f"Agent {path} malformed frontmatter")
    meta = yaml.safe_load(text[3:end].strip()) or {}

    return AgentRole(
        name=meta.get("name", path.stem),
        display_name=meta.get("display_name", path.stem),
        description=meta.get("description", ""),
        allowed_skills=meta.get("allowed_skills", []),
        allowed_channels=meta.get("allowed_channels", []),
        llm_routing=meta.get("llm_routing", {}),
        system_prompt=meta.get("system_prompt", ""),
        safety=meta.get("safety", []),
    )


# Global registry
agent_registry = AgentRegistry()
