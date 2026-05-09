"""LinkedIn OAuth 2.0 / OIDC client.

Three responsibilities:
- Build the authorize URL the browser is redirected to.
- Exchange the auth code returned by LinkedIn for an access token.
- Fetch the OIDC userinfo blob for that token.

We use the "Sign In with LinkedIn using OpenID Connect" product, which is the
only LinkedIn auth product that's self-serve (no app review). Scopes are
`openid profile email`; userinfo returns sub, name, given_name, family_name,
picture, email, email_verified, locale. Rich-profile scopes (r_basicprofile,
DMA) require Marketing Developer Platform partner approval.
"""

from __future__ import annotations

from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from app.core.config import settings

AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization"
TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
USERINFO_URL = "https://api.linkedin.com/v2/userinfo"


def build_authorize_url(state: str) -> str:
    """Assemble the LinkedIn consent-screen URL for a fresh OAuth attempt."""
    if not settings.linkedin_client_id:
        raise HTTPException(
            status_code=503,
            detail="LinkedIn OAuth not configured: LINKEDIN_CLIENT_ID is empty",
        )
    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": settings.linkedin_redirect_uri,
        "state": state,
        "scope": settings.linkedin_scopes,
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> str:
    """Trade the auth code for an access token. Returns the access_token string."""
    if not settings.linkedin_client_secret:
        raise HTTPException(
            status_code=503,
            detail="LinkedIn OAuth not configured: LINKEDIN_CLIENT_SECRET is empty",
        )
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.linkedin_redirect_uri,
        "client_id": settings.linkedin_client_id,
        "client_secret": settings.linkedin_client_secret,
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
            detail=f"LinkedIn token exchange failed ({resp.status_code}): {resp.text}",
        )
    payload = resp.json()
    token = payload.get("access_token")
    if not token:
        raise HTTPException(
            status_code=502,
            detail=f"LinkedIn token response missing access_token: {payload}",
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
            detail=f"LinkedIn userinfo fetch failed ({resp.status_code}): {resp.text}",
        )
    return resp.json()
