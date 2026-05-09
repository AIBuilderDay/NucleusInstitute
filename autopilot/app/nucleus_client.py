"""Thin async HTTP wrapper around the Nucleus matching backend.

This service does NOT import the Nucleus backend's Python modules — it talks
to it strictly over HTTP, the same way the recruiter frontend does. That keeps
the autopilot independently deployable and re-uses the existing CORS / auth
posture.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from .config import settings

logger = logging.getLogger("autopilot.nucleus")

API_PREFIX = "/api/v1"


class NucleusClient:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or settings.nucleus_backend_url).rstrip("/")
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=30.0)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def health(self) -> dict:
        r = await self._client.get("/health")
        r.raise_for_status()
        return r.json()

    async def list_startups(self) -> list[dict]:
        r = await self._client.get(f"{API_PREFIX}/startup")
        r.raise_for_status()
        return r.json().get("items", [])

    async def get_startup(self, startup_id: str) -> dict:
        r = await self._client.get(f"{API_PREFIX}/startup/{startup_id}")
        r.raise_for_status()
        return r.json()

    async def create_startup(self, payload: dict[str, Any]) -> dict:
        r = await self._client.post(f"{API_PREFIX}/startup", json=payload)
        r.raise_for_status()
        return r.json()

    async def get_talent(self, talent_id: str) -> dict:
        r = await self._client.get(f"{API_PREFIX}/talent/{talent_id}")
        r.raise_for_status()
        return r.json()

    async def find_operators(
        self,
        startup_id: str,
        body: dict[str, Any],
        top_k: int = 25,
    ) -> dict:
        r = await self._client.post(
            f"{API_PREFIX}/discover/from/startup/{startup_id}/operators",
            params={"top_k": top_k},
            json=body,
        )
        r.raise_for_status()
        return r.json()

    async def find_students_interns(
        self,
        startup_id: str,
        body: dict[str, Any],
        top_k: int = 25,
    ) -> dict:
        r = await self._client.post(
            f"{API_PREFIX}/discover/from/startup/{startup_id}/students_interns",
            params={"top_k": top_k},
            json=body,
        )
        r.raise_for_status()
        return r.json()

    async def send_email(
        self,
        *,
        startup_id: str,
        talent_id: str,
        subject: str,
        variables: dict[str, Any],
        reply_to: str | None = None,
    ) -> dict:
        body: dict[str, Any] = {
            "sender_type": "startup",
            "sender_id": startup_id,
            "recipient_type": "talent",
            "recipient_id": talent_id,
            "subject": subject,
            "variables": variables,
        }
        if reply_to:
            body["reply_to"] = reply_to
        r = await self._client.post(f"{API_PREFIX}/email/send", json=body)
        # Surface 503 (no Resend key) as a domain error rather than raising —
        # the agent should learn it can't send and stop trying.
        if r.status_code == 503:
            return {"sent": False, "to": None, "error": r.json().get("detail", "503")}
        r.raise_for_status()
        return r.json()
