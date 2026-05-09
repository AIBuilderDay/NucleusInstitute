"""Auth API routes — LinkedIn OAuth (OpenID Connect) flow.

Three endpoints:

  GET /auth/linkedin/login     -- 302 to LinkedIn consent screen
  GET /auth/linkedin/callback  -- LinkedIn redirects here with ?code=&state=
                                 we exchange the code, fetch userinfo, stash it
                                 under a one-shot handoff token, and 302 the
                                 browser to the frontend with that token.
  GET /auth/linkedin/handoff   -- frontend pops userinfo by token (single-use).

No tokens persisted, no sessions issued. The next PR will add the user/talent
linkage when the schema lands.
"""

from __future__ import annotations

from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app.core import handoff_cache, linkedin_oauth, oauth_state
from app.core.config import settings
from app.model.schema.auth import LinkedInHandoffResponse

router = APIRouter()

STATE_COOKIE_NAME = "linkedin_oauth_state"
STATE_COOKIE_MAX_AGE_S = 600


@router.get("/linkedin/login")
async def linkedin_login() -> RedirectResponse:
    """Begin the OAuth dance: mint state, set cookie, redirect to LinkedIn."""
    state = oauth_state.make_state(settings.oauth_state_secret)
    authorize_url = linkedin_oauth.build_authorize_url(state)

    response = RedirectResponse(url=authorize_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=STATE_COOKIE_NAME,
        value=state,
        max_age=STATE_COOKIE_MAX_AGE_S,
        httponly=True,
        samesite="lax",
        secure=settings.environment != "development",
        path="/",
    )
    return response


@router.get("/linkedin/callback")
async def linkedin_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> RedirectResponse:
    """Receive LinkedIn's redirect, finish the token exchange, hand off to frontend."""
    if error:
        raise HTTPException(
            status_code=400,
            detail=f"LinkedIn returned error: {error} ({error_description or 'no description'})",
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state in callback")

    state_cookie = request.cookies.get(STATE_COOKIE_NAME)
    if not oauth_state.verify_state(state, state_cookie, settings.oauth_state_secret):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    access_token = await linkedin_oauth.exchange_code(code)
    userinfo = await linkedin_oauth.fetch_userinfo(access_token)

    handoff_token = await handoff_cache.put(userinfo)

    redirect_url = f"{settings.frontend_onboard_url}?{urlencode({'linkedin_handoff': handoff_token})}"
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(STATE_COOKIE_NAME, path="/")
    return response


@router.get("/linkedin/handoff", response_model=LinkedInHandoffResponse)
async def linkedin_handoff(token: str) -> LinkedInHandoffResponse:
    """Frontend pops the userinfo blob using its one-shot handoff token."""
    payload = await handoff_cache.pop(token)
    if payload is None:
        raise HTTPException(status_code=404, detail="Handoff token missing or expired")
    return LinkedInHandoffResponse.model_validate(payload)
