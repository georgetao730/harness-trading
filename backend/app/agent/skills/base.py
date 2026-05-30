"""Skills System - Pluggable skill modules for the trading agent"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
from loguru import logger


class SkillCategory(str, Enum):
    MARKET_DATA = "market_data"
    TECHNICAL = "technical"
    FUNDAMENTAL = "fundamental"
    NLP = "nlp"
    LLM_REASONING = "llm_reasoning"
    EXECUTION = "execution"


@dataclass
class SkillResult:
    success: bool
    data: Any = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseSkill(ABC):
    """Abstract base for all trading skills."""

    category: SkillCategory
    name: str
    description: str

    @abstractmethod
    async def execute(self, **kwargs) -> SkillResult:
        """Execute the skill with given parameters."""
        ...

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "category": self.category.value,
            "description": self.description,
        }


class SkillRegistry:
    """Registry for all available skills."""

    def __init__(self):
        self._skills: Dict[str, BaseSkill] = {}
        self._aliases: Dict[str, str] = {}

    def register(self, skill: BaseSkill):
        self._skills[skill.name] = skill
        logger.info(f"Registered skill: {skill.name} [{skill.category.value}]")

    def alias(self, name: str, target: str) -> None:
        """Create an alias so workflows can use a different name."""
        self._aliases[name] = target
        logger.debug(f"Skill alias: {name} -> {target}")

    def get(self, name: str) -> Optional[BaseSkill]:
        # Check direct name first, then alias
        skill = self._skills.get(name)
        if skill:
            return skill
        target = self._aliases.get(name)
        if target:
            return self._skills.get(target)
        return None

    def list_by_category(self, category: Optional[SkillCategory] = None) -> List[BaseSkill]:
        skills = list(self._skills.values())
        if category:
            skills = [s for s in skills if s.category == category]
        return skills

    def list_all(self) -> Dict[str, dict]:
        result = {}
        for name, skill in self._skills.items():
            result[name] = skill.to_dict()
        # Also show aliases
        for alias_name, target in self._aliases.items():
            if target in self._skills:
                result[alias_name] = {**self._skills[target].to_dict(), "_alias_for": target}
        return result


# Global skill registry
skill_registry = SkillRegistry()
