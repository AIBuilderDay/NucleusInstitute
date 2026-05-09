"""Matching providers package.

Importing this module registers all matchers via the `@register_matcher`
decorator. Anything that needs the registry should import this package first
(e.g. `app/main.py` does so on startup) so the registry is hydrated before
requests arrive.
"""

from app.provider.matching import agentic_filter as _agentic_filter  # noqa: F401  (registers AgenticFilterMatcher)
from app.provider.matching import embedding as _embedding  # noqa: F401  (registers EmbeddingMatcher + EmbeddingBlendedMatcher)
from app.provider.matching import rule_filter as _rule_filter  # noqa: F401  (registers RuleFilterMatcher)
from app.provider.matching.base import (
    MatchingProvider,
    get_matcher,
    list_matchers,
    register_matcher,
)

__all__ = ["MatchingProvider", "get_matcher", "list_matchers", "register_matcher"]
