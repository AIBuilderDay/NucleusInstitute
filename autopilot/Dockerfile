FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .

EXPOSE 8766

# `uv sync --frozen` is idempotent: no-op when the bind-mounted .venv is
# already valid, otherwise it rebuilds it (e.g. when a host venv linked to
# a missing Python leaks in via the bind mount). Then we exec uvicorn.
CMD ["sh", "-c", "uv sync --frozen && exec uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port 8766 --reload"]
