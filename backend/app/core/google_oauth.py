"""Google OAuth 2.0 / OIDC client.

Three responsibilities (mirror of `app.core.linkedin_oauth`):
- Build the authorize URL the browser is redirected to.
- Exchange the auth code returned by Google for an access token.
- Fetch the OIDC userinfo blob for that token.

We use Google Identity Services (the standard `accounts.google.com` OAuth 2.0 +
OpenID Connect endpoints), which is self-serve via the Google Cloud Console:
create an OAuth 2.0 Client ID under "APIs & Services -> Credentials",
add the redirect URI to the allowlist there, then drop the client_id /
client_secret into `.env`. Scopes are `openid profile email`; userinfo returns
sub, name, given_name, family_name, picture, email, email_verified, locale.
"""

from __future__ import annotations

from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from app.core.config import settings

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def build_authorize_url(state: str) -> str:
    """Assemble the Google consent-screen URL for a fresh OAuth attempt."""
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured: GOOGLE_CLIENT_ID is empty",
        )
    params = {
        "response_type": "code",
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "state": state,
        "scope": settings.google_scopes,
        # `select_account` lets users pick which Google account to use even if
        # they're already signed into one in the browser. Not strictly required
        # but matches the UX users expect from "Sign in with Google" buttons.
        "prompt": "select_account",
        "access_type": "online",
        "include_granted_scopes": "true",
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> str:
    """Trade the auth code for an access token. Returns the access_token string."""
    if not settings.google_client_secret:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured: GOOGLE_CLIENT_SECRET is empty",
        )
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.google_redirect_uri,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            TOKEN_URL,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Google token exchange failed ({resp.status_code}): {resp.text}",
        )
    payload = resp.json()
    token = payload.get("access_token")
    if not token:
        raise HTTPException(
            status_code=502,
            detail=f"Google token response missing access_token: {payload}",
        )
    return token


async def fetch_userinfo(access_token: str) -> dict:
    """Pull OIDC userinfo for the freshly-issued access token."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Google userinfo fetch failed ({resp.status_code}): {resp.text}",
        )
    return resp.json()
