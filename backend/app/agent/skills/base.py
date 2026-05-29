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

    def register(self, skill: BaseSkill):
        self._skills[skill.name] = skill
        logger.info(f"Registered skill: {skill.name} [{skill.category.value}]")

    def get(self, name: str) -> Optional[BaseSkill]:
        return self._skills.get(name)

    def list_by_category(self, category: Optional[SkillCategory] = None) -> List[BaseSkill]:
        skills = list(self._skills.values())
        if category:
            skills = [s for s in skills if s.category == category]
        return skills

    def list_all(self) -> Dict[str, dict]:
        return {name: skill.to_dict() for name, skill in self._skills.items()}


# Global skill registry
skill_registry = SkillRegistry()
