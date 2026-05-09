"""Auth API routes — LinkedIn + Google OAuth (OpenID Connect) flows.

For each provider:

  GET /auth/<provider>/login     -- 302 to provider consent screen
  GET /auth/<provider>/callback  -- provider redirects here with ?code=&state=
                                    we exchange the code, fetch userinfo, stash
                                    it under a one-shot handoff token, and 302
                                    the browser to the frontend with that token.
  GET /auth/<provider>/handoff   -- frontend pops userinfo by token (single-use).

Both providers feed into the same handoff cache and the same onboarding agent.
The frontend distinguishes them by query param: `?linkedin_handoff=<token>` vs
`?google_handoff=<token>`.

No tokens persisted, no sessions issued. The next PR will add the user/talent
linkage when the schema lands.
"""

from __future__ import annotations

from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from app.core import google_oauth, handoff_cache, linkedin_oauth, oauth_state
from app.core.config import settings
from app.model.schema.auth import GoogleHandoffResponse, LinkedInHandoffResponse

router = APIRouter()

LINKEDIN_STATE_COOKIE_NAME = "linkedin_oauth_state"
GOOGLE_STATE_COOKIE_NAME = "google_oauth_state"
STATE_COOKIE_MAX_AGE_S = 600


# -----------------------------------------------------------------------------
# LinkedIn OAuth
# -----------------------------------------------------------------------------


@router.get("/linkedin/login")
async def linkedin_login() -> RedirectResponse:
    """Begin the OAuth dance: mint state, set cookie, redirect to LinkedIn."""
    state = oauth_state.make_state(settings.oauth_state_secret)
    authorize_url = linkedin_oauth.build_authorize_url(state)

    response = RedirectResponse(url=authorize_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=LINKEDIN_STATE_COOKIE_NAME,
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

    state_cookie = request.cookies.get(LINKEDIN_STATE_COOKIE_NAME)
    if not oauth_state.verify_state(state, state_cookie, settings.oauth_state_secret):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    access_token = await linkedin_oauth.exchange_code(code)
    userinfo = await linkedin_oauth.fetch_userinfo(access_token)

    handoff_token = await handoff_cache.put(userinfo)

    redirect_url = f"{settings.frontend_onboard_url}?{urlencode({'linkedin_handoff': handoff_token})}"
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(LINKEDIN_STATE_COOKIE_NAME, path="/")
    return response


@router.get("/linkedin/handoff", response_model=LinkedInHandoffResponse)
async def linkedin_handoff(token: str) -> LinkedInHandoffResponse:
    """Frontend pops the userinfo blob using its one-shot handoff token."""
    payload = await handoff_cache.pop(token)
    if payload is None:
        raise HTTPException(status_code=404, detail="Handoff token missing or expired")
    return LinkedInHandoffResponse.model_validate(payload)


# -----------------------------------------------------------------------------
# Google OAuth
# -----------------------------------------------------------------------------


@router.get("/google/login")
async def google_login() -> RedirectResponse:
    """Begin the OAuth dance: mint state, set cookie, redirect to Google."""
    state = oauth_state.make_state(settings.oauth_state_secret)
    authorize_url = google_oauth.build_authorize_url(state)

    response = RedirectResponse(url=authorize_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=GOOGLE_STATE_COOKIE_NAME,
        value=state,
        max_age=STATE_COOKIE_MAX_AGE_S,
        httponly=True,
        samesite="lax",
        secure=settings.environment != "development",
        path="/",
    )
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> RedirectResponse:
    """Receive Google's redirect, finish the token exchange, hand off to frontend."""
    if error:
        raise HTTPException(
            status_code=400,
            detail=f"Google returned error: {error} ({error_description or 'no description'})",
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state in callback")

    state_cookie = request.cookies.get(GOOGLE_STATE_COOKIE_NAME)
    if not oauth_state.verify_state(state, state_cookie, settings.oauth_state_secret):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    access_token = await google_oauth.exchange_code(code)
    userinfo = await google_oauth.fetch_userinfo(access_token)

    handoff_token = await handoff_cache.put(userinfo)

    redirect_url = f"{settings.frontend_onboard_url}?{urlencode({'google_handoff': handoff_token})}"
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(GOOGLE_STATE_COOKIE_NAME, path="/")
    return response


@router.get("/google/handoff", response_model=GoogleHandoffResponse)
async def google_handoff(token: str) -> GoogleHandoffResponse:
    """Frontend pops the userinfo blob using its one-shot handoff token."""
    payload = await handoff_cache.pop(token)
    if payload is None:
        raise HTTPException(status_code=404, detail="Handoff token missing or expired")
    return GoogleHandoffResponse.model_validate(payload)
