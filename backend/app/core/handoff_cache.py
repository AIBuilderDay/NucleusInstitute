"""In-process TTL cache for the OAuth -> onboard handoff.

The OAuth callback can't return JSON to the browser (it's a redirect from
LinkedIn). Instead we stash the userinfo here under a random one-shot token,
redirect the browser to the frontend with that token in the query string, and
let the frontend pop the userinfo via a separate endpoint.

Single-process only. When we go multi-process, replace with Redis.
"""

from __future__ import annotations

import asyncio
import secrets
import time
from typing import Any

_HANDOFF_TTL_S = 300  # 5 minutes
_store: dict[str, tuple[float, dict[str, Any]]] = {}
_lock = asyncio.Lock()


async def put(payload: dict[str, Any], ttl_s: int = _HANDOFF_TTL_S) -> str:
    """Store payload, return a fresh single-use token."""
    token = secrets.token_urlsafe(24)
    expires_at = time.time() + ttl_s
    async with _lock:
        _prune_expired_locked()
        _store[token] = (expires_at, payload)
    return token


async def pop(token: str) -> dict[str, Any] | None:
    """Single-use read. Returns None if missing, expired, or already consumed."""
    async with _lock:
        entry = _store.pop(token, None)
        _prune_expired_locked()
    if entry is None:
        return None
    expires_at, payload = entry
    if time.time() > expires_at:
        return None
    return payload


def _prune_expired_locked() -> None:
    """Caller must hold _lock."""
    now = time.time()
    expired = [k for k, (exp, _) in _store.items() if exp < now]
    for k in expired:
        _store.pop(k, None)
