"""Embedding-based matchers — `embedding` (pure cosine) and `embedding_blended`.

Both share an `EmbeddingEngine` singleton that handles the expensive bits:
loading `all-MiniLM-L6-v2` once per process (Apache 2.0, runs offline, no API
calls), pulling profile_extension rows in a single batch query, constructing
embedding text from core + extension fields, and persisting vectors to the
`profile_embedding` table so we don't re-encode the same profile on every
cold start.

TWO MATCHERS, ONE ENGINE
------------------------
* `embedding`         → score = clamped cosine similarity. Hard filters from
                        rule_filter still apply (so we don't surface someone
                        who's geographically incompatible just because their
                        bio reads similar).
* `embedding_blended` → score = 0.6 * cosine + 0.4 * rule_filter score. Same
                        hard filters. Useful when structured-field overlap
                        should still tip the ordering.

Both expose rule_filter's `dimension_scores` and `blockers` on every result
so the existing match card UI keeps rendering identically. The `reasons`
field gets a leading "Strong semantic alignment" bullet when cosine clears
the threshold; otherwise rule_filter's reasons carry through unchanged.

DESIGN NOTES
------------
* Lazy model load — `_get_model()` defers the `SentenceTransformer(...)`
  call to first match. Loading at import time would slow every test that
  imports `provider.matching` and the app's cold-start handshake too. Per
  THINGS2NOTE.md "Matcher registry instantiates eagerly" warning.
* Async-safety — `model.encode(...)` is sync + CPU-bound. Wrapped in
  `asyncio.to_thread` so /match/.../compare can fan out across all
  matchers without blocking the event loop.
* Cache layers:
    L1 (in-process): keyed on signature, vector kept as numpy array.
    L2 (DB):         `profile_embedding` table, keyed on
                     (entity_type, entity_id, model_name) with
                     `source_signature` recording the hash of the text
                     that produced the vector. On read, signature mismatch
                     triggers re-encode + upsert.
* Source signature — sha256 of the constructed text (truncated to 32 chars).
  Captures any change to bio, headline, skills, sectors, mission, AND any
  bio_extended / highlights / projects edits, in one hash. No need to
  juggle multiple updated_at columns.
"""

from __future__ import annotations

import asyncio
import hashlib
from typing import TYPE_CHECKING
from uuid import UUID

import numpy as np
from sqlalchemy import select

from app.database.connection import session_factory
from app.model.database.profile_embedding import ProfileEmbedding
from app.model.database.startup import Startup
from app.model.database.startup_profile_extension import StartupProfileExtension
from app.model.database.talent import Talent
from app.model.database.talent_profile_extension import TalentProfileExtension
from app.model.schema.match import MatchResult
from app.provider.matching.base import MatchingProvider, register_matcher
from app.provider.matching.rule_filter import RuleFilterMatcher

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dim — sanity check on read
EMBEDDING_WEIGHT = 0.6
RULE_FILTER_WEIGHT = 0.4
SEMANTIC_REASON_THRESHOLD = 0.55


# =============================================================================
# Shared engine — both matchers reuse this so we load the model once and share
# the embedding cache across both /compare lanes.
# =============================================================================
class EmbeddingEngine:
    """Loads the model lazily, embeds + caches profile vectors."""

    def __init__(self) -> None:
        self._model: SentenceTransformer | None = None
        # In-process L1 cache: source_signature -> vector
        self._vector_cache: dict[str, np.ndarray] = {}

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(MODEL_NAME)
        return self._model

    # ------------------------------------------------------------------
    # Text construction
    # ------------------------------------------------------------------
    @staticmethod
    def talent_text(t: Talent, ext: TalentProfileExtension | None) -> str:
        parts: list[str] = [f"Name: {t.name}"]
        if t.headline:
            parts.append(f"Headline: {t.headline}")
        parts.append(f"Role: {t.role_category}")
        if t.role_titles_seeking:
            parts.append(f"Seeking: {', '.join(t.role_titles_seeking)}")
        if t.sectors_of_interest:
            parts.append(f"Sectors: {', '.join(t.sectors_of_interest)}")
        if t.skills:
            parts.append(f"Skills: {', '.join(t.skills)}")
        if t.domain_expertise:
            parts.append(f"Domain: {', '.join(t.domain_expertise)}")
        if t.mission_keywords:
            parts.append(f"Mission: {', '.join(t.mission_keywords)}")
        if t.bio:
            parts.append(f"Bio: {t.bio}")
        if ext is not None:
            if ext.bio_extended:
                parts.append(f"More: {ext.bio_extended}")
            if ext.highlights:
                parts.append(f"Highlights: {' | '.join(ext.highlights)}")
            if ext.projects:
                project_lines: list[str] = []
                for p in ext.projects:
                    if not isinstance(p, dict):
                        continue
                    title = str(p.get("title") or p.get("name") or "").strip()
                    desc = str(p.get("description") or p.get("summary") or "").strip()
                    if title and desc:
                        project_lines.append(f"{title}: {desc}")
                    elif title:
                        project_lines.append(title)
                    elif desc:
                        project_lines.append(desc)
                if project_lines:
                    parts.append(f"Projects: {' | '.join(project_lines)}")
        return "\n".join(parts)

    @staticmethod
    def startup_text(s: Startup, ext: StartupProfileExtension | None) -> str:
        parts: list[str] = [f"Name: {s.name}"]
        if s.one_liner:
            parts.append(f"One-liner: {s.one_liner}")
        parts.append(f"Sector: {s.sector}")
        if s.sectors_secondary:
            parts.append(f"Also: {', '.join(s.sectors_secondary)}")
        parts.append(f"Stage: {s.stage}")
        if s.required_skills:
            parts.append(f"Required skills: {', '.join(s.required_skills)}")
        if s.nice_to_have_skills:
            parts.append(f"Nice-to-have: {', '.join(s.nice_to_have_skills)}")
        if s.mission_keywords:
            parts.append(f"Mission: {', '.join(s.mission_keywords)}")
        if s.description:
            parts.append(f"Description: {s.description}")
        if ext is not None:
            if ext.description_extended:
                parts.append(f"More: {ext.description_extended}")
            if ext.highlights:
                parts.append(f"Highlights: {' | '.join(ext.highlights)}")
        return "\n".join(parts)

    @staticmethod
    def _signature(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]

    # ------------------------------------------------------------------
    # Extension batch fetch (one query per entity type per call)
    # ------------------------------------------------------------------
    @staticmethod
    async def _fetch_talent_exts(
        ids: list[UUID],
    ) -> dict[UUID, TalentProfileExtension]:
        if not ids:
            return {}
        async with session_factory() as session:
            stmt = select(TalentProfileExtension).where(
                TalentProfileExtension.talent_id.in_(ids)
            )
            result = await session.execute(stmt)
            return {e.talent_id: e for e in result.scalars().all()}

    @staticmethod
    async def _fetch_startup_exts(
        ids: list[UUID],
    ) -> dict[UUID, StartupProfileExtension]:
        if not ids:
            return {}
        async with session_factory() as session:
            stmt = select(StartupProfileExtension).where(
                StartupProfileExtension.startup_id.in_(ids)
            )
            result = await session.execute(stmt)
            return {e.startup_id: e for e in result.scalars().all()}

    # ------------------------------------------------------------------
    # Encoding (with L1 + L2 cache)
    # ------------------------------------------------------------------
    async def _encode(self, texts: list[str]) -> np.ndarray:
        """Run the model on a batch of texts, returning unit-normalized vectors."""
        model = self._get_model()
        return await asyncio.to_thread(
            model.encode,
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

    async def embed_talents(
        self, talents: list[Talent]
    ) -> dict[UUID, np.ndarray]:
        """Return {talent_id: unit-vector} for every input talent.

        Order of operations: build text → check L1 cache → check L2 (DB) →
        encode any remaining → upsert L2 → seed L1.
        """
        if not talents:
            return {}
        exts = await self._fetch_talent_exts([t.id for t in talents])
        return await self._embed_entities(
            entities=talents,
            entity_type="talent",
            id_attr="id",
            text_fn=lambda t: self.talent_text(t, exts.get(t.id)),
        )

    async def embed_startups(
        self, startups: list[Startup]
    ) -> dict[UUID, np.ndarray]:
        if not startups:
            return {}
        exts = await self._fetch_startup_exts([s.id for s in startups])
        return await self._embed_entities(
            entities=startups,
            entity_type="startup",
            id_attr="id",
            text_fn=lambda s: self.startup_text(s, exts.get(s.id)),
        )

    async def _embed_entities(
        self,
        *,
        entities: list,
        entity_type: str,
        id_attr: str,
        text_fn,
    ) -> dict[UUID, np.ndarray]:
        out: dict[UUID, np.ndarray] = {}

        # Step 1: build text + signature for every entity, hit L1 first.
        plans: list[tuple[UUID, str, str]] = []  # (id, text, signature)
        misses: list[tuple[UUID, str, str]] = []
        for ent in entities:
            ent_id: UUID = getattr(ent, id_attr)
            text = text_fn(ent)
            sig = self._signature(text)
            cached_vec = self._vector_cache.get(sig)
            if cached_vec is not None:
                out[ent_id] = cached_vec
            else:
                plans.append((ent_id, text, sig))
                misses.append((ent_id, text, sig))

        if not misses:
            return out

        # Step 2: try L2 (DB) for the L1 misses.
        miss_ids = [m[0] for m in misses]
        async with session_factory() as session:
            stmt = select(ProfileEmbedding).where(
                ProfileEmbedding.entity_type == entity_type,
                ProfileEmbedding.model_name == MODEL_NAME,
                ProfileEmbedding.entity_id.in_(miss_ids),
            )
            result = await session.execute(stmt)
            db_rows = {row.entity_id: row for row in result.scalars().all()}

        still_missing: list[tuple[UUID, str, str]] = []
        for ent_id, text, sig in misses:
            row = db_rows.get(ent_id)
            if row is not None and row.source_signature == sig and row.dim == EMBEDDING_DIM:
                vec = np.frombuffer(row.vector, dtype=np.float32)
                if vec.shape == (EMBEDDING_DIM,):
                    self._vector_cache[sig] = vec
                    out[ent_id] = vec
                    continue
            still_missing.append((ent_id, text, sig))

        if not still_missing:
            return out

        # Step 3: encode the remaining misses, upsert L2, populate L1.
        texts_to_encode = [item[1] for item in still_missing]
        new_vectors = await self._encode(texts_to_encode)

        async with session_factory() as session:
            for (ent_id, _text, sig), vec in zip(
                still_missing, new_vectors, strict=True
            ):
                vec32 = np.asarray(vec, dtype=np.float32)
                self._vector_cache[sig] = vec32
                out[ent_id] = vec32

                stmt = select(ProfileEmbedding).where(
                    ProfileEmbedding.entity_type == entity_type,
                    ProfileEmbedding.entity_id == ent_id,
                    ProfileEmbedding.model_name == MODEL_NAME,
                )
                existing = (await session.execute(stmt)).scalar_one_or_none()
                if existing is None:
                    session.add(
                        ProfileEmbedding(
                            entity_type=entity_type,
                            entity_id=ent_id,
                            model_name=MODEL_NAME,
                            source_signature=sig,
                            vector=vec32.tobytes(),
                            dim=EMBEDDING_DIM,
                        )
                    )
                else:
                    existing.source_signature = sig
                    existing.vector = vec32.tobytes()
                    existing.dim = EMBEDDING_DIM
            await session.commit()

        return out


# Process-wide engine. Both matchers share it so the model loads once and
# the cache is unified across `embedding` and `embedding_blended` lanes.
_engine = EmbeddingEngine()


# =============================================================================
# Pre-warm helpers — fired as background tasks from create endpoints so a brand
# new profile already has its vector in `profile_embedding` by the time anyone
# runs /match against it. Best-effort: any failure is logged and swallowed,
# because the matcher will lazy-compute on the next /match call anyway.
# =============================================================================
async def prewarm_talent_embedding(talent_id: UUID) -> None:
    try:
        async with session_factory() as session:
            stmt = select(Talent).where(Talent.id == talent_id)
            t = (await session.execute(stmt)).scalar_one_or_none()
            if t is None:
                return
            await _engine.embed_talents([t])
    except Exception as exc:  # noqa: BLE001  bg task — never crash the worker
        from app.core.config import settings

        settings.logger.warning(f"prewarm_talent_embedding({talent_id}) failed: {exc}")


async def prewarm_startup_embedding(startup_id: UUID) -> None:
    try:
        async with session_factory() as session:
            stmt = select(Startup).where(Startup.id == startup_id)
            s = (await session.execute(stmt)).scalar_one_or_none()
            if s is None:
                return
            await _engine.embed_startups([s])
    except Exception as exc:  # noqa: BLE001
        from app.core.config import settings

        settings.logger.warning(
            f"prewarm_startup_embedding({startup_id}) failed: {exc}"
        )


# =============================================================================
# Helpers — composing MatchResult from rule_filter + cosine
# =============================================================================
def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    """Vectors are already unit-normalized at write time, so dot = cosine."""
    return float(np.dot(a, b))


def _build_result(
    *,
    t: Talent,
    s: Startup,
    cosine: float,
    matcher_name: str,
    rule_filter: RuleFilterMatcher,
    blend: bool,
) -> MatchResult:
    """Run rule_filter for hard filters + dimension scores, then layer cosine on top."""
    rf = rule_filter._score_pair(t, s)  # noqa: SLF001  internal score helper
    cosine_clamped = max(0.0, min(1.0, cosine))

    if not rf.passed_hard_filters:
        score = 0.0
    elif blend:
        score = round(
            EMBEDDING_WEIGHT * cosine_clamped + RULE_FILTER_WEIGHT * rf.score,
            3,
        )
    else:
        score = round(cosine_clamped, 3)

    dim_scores = dict(rf.dimension_scores)
    dim_scores["semantic_similarity"] = round(cosine_clamped, 3)

    reasons = list(rf.reasons)
    if rf.passed_hard_filters and cosine_clamped >= SEMANTIC_REASON_THRESHOLD:
        reasons.insert(0, f"Strong semantic alignment (cosine {cosine_clamped:.2f})")

    return MatchResult(
        talent_id=rf.talent_id,
        startup_id=rf.startup_id,
        score=score,
        passed_hard_filters=rf.passed_hard_filters,
        dimension_scores=dim_scores,
        reasons=reasons,
        blockers=rf.blockers,
        matcher=matcher_name,
    )


# =============================================================================
# Pure embedding matcher — score = cosine, hard filters preserved
# =============================================================================
@register_matcher
class EmbeddingMatcher(MatchingProvider):
    """Score = clamped cosine similarity. Hard filters from rule_filter still apply."""

    name = "embedding"

    def __init__(self) -> None:
        self._rule_filter = RuleFilterMatcher()

    async def match_talent_to_startups(
        self,
        talent: Talent,
        startups: list[Startup],
        top_k: int = 5,
    ) -> list[MatchResult]:
        t_vecs = await _engine.embed_talents([talent])
        s_vecs = await _engine.embed_startups(startups)
        t_vec = t_vecs[talent.id]
        results = [
            _build_result(
                t=talent,
                s=s,
                cosine=_cosine(t_vec, s_vecs[s.id]),
                matcher_name=self.name,
                rule_filter=self._rule_filter,
                blend=False,
            )
            for s in startups
        ]
        results.sort(key=lambda r: (r.passed_hard_filters, r.score), reverse=True)
        return results[:top_k]

    async def match_startup_to_talent(
        self,
        startup: Startup,
        talents: list[Talent],
        top_k: int = 5,
    ) -> list[MatchResult]:
        t_vecs = await _engine.embed_talents(talents)
        s_vecs = await _engine.embed_startups([startup])
        s_vec = s_vecs[startup.id]
        results = [
            _build_result(
                t=t,
                s=startup,
                cosine=_cosine(t_vecs[t.id], s_vec),
                matcher_name=self.name,
                rule_filter=self._rule_filter,
                blend=False,
            )
            for t in talents
        ]
        results.sort(key=lambda r: (r.passed_hard_filters, r.score), reverse=True)
        return results[:top_k]


# =============================================================================
# Blended matcher — 0.6 * cosine + 0.4 * rule_filter, hard filters preserved
# =============================================================================
@register_matcher
class EmbeddingBlendedMatcher(MatchingProvider):
    """Score = 0.6 * cosine + 0.4 * rule_filter. Hard filters from rule_filter apply."""

    name = "embedding_blended"

    def __init__(self) -> None:
        self._rule_filter = RuleFilterMatcher()

    async def match_talent_to_startups(
        self,
        talent: Talent,
        startups: list[Startup],
        top_k: int = 5,
    ) -> list[MatchResult]:
        t_vecs = await _engine.embed_talents([talent])
        s_vecs = await _engine.embed_startups(startups)
        t_vec = t_vecs[talent.id]
        results = [
            _build_result(
                t=talent,
                s=s,
                cosine=_cosine(t_vec, s_vecs[s.id]),
                matcher_name=self.name,
                rule_filter=self._rule_filter,
                blend=True,
            )
            for s in startups
        ]
        results.sort(key=lambda r: (r.passed_hard_filters, r.score), reverse=True)
        return results[:top_k]

    async def match_startup_to_talent(
        self,
        startup: Startup,
        talents: list[Talent],
        top_k: int = 5,
    ) -> list[MatchResult]:
        t_vecs = await _engine.embed_talents(talents)
        s_vecs = await _engine.embed_startups([startup])
        s_vec = s_vecs[startup.id]
        results = [
            _build_result(
                t=t,
                s=startup,
                cosine=_cosine(t_vecs[t.id], s_vec),
                matcher_name=self.name,
                rule_filter=self._rule_filter,
                blend=True,
            )
            for t in talents
        ]
        results.sort(key=lambda r: (r.passed_hard_filters, r.score), reverse=True)
        return results[:top_k]
