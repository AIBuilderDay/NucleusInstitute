"""Abstract MatchingProvider + registry.

This module is the load-bearing piece for the "swappable matching algorithms"
requirement (PLAN.md §2a). Every matcher implements this interface; routes and
services only ever talk to the abstract base, so we can drop in embedding-based
or agentic matchers without touching anything outside `provider/matching/`.

USAGE
-----
1. Subclass `MatchingProvider`, set `name = "..."`, implement both `match_*` methods.
2. Decorate the class with `@register_matcher` to add it to the global registry.
3. Look it up via `get_matcher("name")` from `MatchingService`.

THE MATCHRESULT CONTRACT
------------------------
Every matcher MUST return a list of `MatchResult` (Pydantic model in
`app/model/schema/match.py`) with these fields populated:
- `score`: float in [0, 1]
- `passed_hard_filters`: bool — was this pair eliminated by hard filters?
- `dimension_scores`: dict of named dimensions to per-dimension 0–1 scores
  (drives the "Why was I matched?" UI). Keys are matcher-specific.
- `reasons`: list of human-readable bullets ("Strong sector overlap: AI")
- `blockers`: list of hard-filter failure messages (only populated if
  `passed_hard_filters` is False)
- `matcher`: the matcher's `name` field

This shape is uniform so the frontend match card renders identically regardless
of which matcher produced the data.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.model.database.startup import Startup
    from app.model.database.talent import Talent
    from app.model.schema.match import MatchResult


class MatchingProvider(ABC):
    """Abstract matcher. All concrete matchers extend this."""

    name: str = "abstract"

    @abstractmethod
    async def match_talent_to_startups(
        self,
        talent: Talent,
        startups: list[Startup],
        top_k: int = 5,
    ) -> list[MatchResult]:
        """Return the best `top_k` startups for this talent, descending by score."""
        raise NotImplementedError

    @abstractmethod
    async def match_startup_to_talent(
        self,
        startup: Startup,
        talents: list[Talent],
        top_k: int = 5,
    ) -> list[MatchResult]:
        """Return the best `top_k` talent for this startup, descending by score."""
        raise NotImplementedError


# -----------------------------------------------------------------------------
# Registry
# -----------------------------------------------------------------------------
_registry: dict[str, MatchingProvider] = {}


def register_matcher(cls: type[MatchingProvider]) -> type[MatchingProvider]:
    """Class decorator that instantiates the matcher and registers it under `cls.name`.

    Matchers are stateless singletons — one instance per process is fine. If a
    future matcher needs per-request state, refactor to a factory function here.
    """
    if cls.name == "abstract":
        raise ValueError(f"{cls.__name__} must override the `name` class attribute before registering")
    if cls.name in _registry:
        raise ValueError(f"matcher {cls.name!r} already registered")
    _registry[cls.name] = cls()
    return cls


def get_matcher(name: str) -> MatchingProvider:
    """Look up a matcher by name. Raises KeyError with available names if unknown."""
    if name not in _registry:
        available = sorted(_registry.keys())
        raise KeyError(f"unknown matcher {name!r}; registered: {available}")
    return _registry[name]


def list_matchers() -> list[str]:
    """All registered matcher names. Used by the /match/.../compare endpoint."""
    return sorted(_registry.keys())
