"""ProfileEmbedding ORM model.

Persists sentence-transformer vectors for talent + startup profiles so the
EmbeddingMatcher doesn't re-encode the same profile on every cold start.
One row per (entity_type, entity_id, model_name) — when the source text
changes, `source_signature` no longer matches and the matcher recomputes
the vector and overwrites the row.

Storage: vectors are stored as raw float32 bytes (LargeBinary). Cross-DB
portable, no JSON parsing on read, and aligns with how `numpy.frombuffer`
expects to consume them. SQLite has no native vector type so this is as
close to pgvector as we get without bringing in extensions.
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Integer, LargeBinary, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.connection import Base


class ProfileEmbedding(Base):
    __tablename__ = "profile_embedding"
    __table_args__ = (
        UniqueConstraint(
            "entity_type", "entity_id", "model_name", name="uq_profile_embedding_entity_model"
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)

    # 'talent' or 'startup'. String rather than enum so adding a new entity
    # kind (e.g. 'project') doesn't require a schema migration.
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    entity_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)

    # Pin the producer of the vector — different models produce
    # incompatible vector spaces, so we keep them as separate rows.
    model_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # Hash of the source text used to produce the vector. The matcher
    # compares this against a freshly-computed hash of the candidate text;
    # mismatch = cache miss, recompute and upsert.
    source_signature: Mapped[str] = mapped_column(String(64), nullable=False)

    # Raw float32 bytes. Use `numpy.frombuffer(vector, dtype=np.float32)` to
    # rehydrate, then `.reshape(dim)` if needed. Vectors are unit-normalized
    # at write time so cosine = dot product.
    vector: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    dim: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
