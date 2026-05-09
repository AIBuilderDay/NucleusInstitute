"""Stateless CSRF protection for the OAuth `state` parameter.

We mint a short-lived HMAC-signed token, set it as an HttpOnly cookie, AND pass
the same value to LinkedIn as `state`. On callback we require both to be present
and to match, which prevents an attacker from forging a callback URL — they'd
need both the cookie value and the URL value, and the cookie is only set in
the user's browser after the /login redirect.

No session store needed. All stdlib.
"""

from __future__ import annotations

import base64
import hmac
import secrets
import time
from hashlib import sha256

# Random per-process fallback secret so dev still works with OAUTH_STATE_SECRET="".
# Production deployments should always set the env var.
_DEV_FALLBACK_SECRET = secrets.token_hex(32)


def _resolve_secret(secret: str) -> bytes:
    return (secret or _DEV_FALLBACK_SECRET).encode("utf-8")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def make_state(secret: str) -> str:
    """Return a signed state token.

    Layout (base64url-decoded): nonce(16) || ts(8 big-endian) || hmac_sha256_truncated(16)
    """
    nonce = secrets.token_bytes(16)
    ts = int(time.time()).to_bytes(8, "big")
    payload = nonce + ts
    sig = hmac.new(_resolve_secret(secret), payload, sha256).digest()[:16]
    return _b64url(payload + sig)


def verify_state(
    token_from_query: str | None,
    token_from_cookie: str | None,
    secret: str,
    max_age_s: int = 600,
) -> bool:
    if not token_from_query or not token_from_cookie:
        return False
    if not hmac.compare_digest(token_from_query, token_from_cookie):
        return False
    try:
        raw = _b64url_decode(token_from_query)
    except (ValueError, TypeError):
        return False
    if len(raw) != 16 + 8 + 16:
        return False
    payload, sig = raw[:24], raw[24:]
    expected = hmac.new(_resolve_secret(secret), payload, sha256).digest()[:16]
    if not hmac.compare_digest(sig, expected):
        return False
    ts = int.from_bytes(payload[16:24], "big")
    age = int(time.time()) - ts
    if age < 0 or age > max_age_s:
        return False
    return True
