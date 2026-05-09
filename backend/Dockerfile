FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY . .

EXPOSE 8765

# See autopilot/Dockerfile for why we sync at startup instead of `--no-sync`.
CMD ["sh", "-c", "uv sync --frozen && exec uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port 8765 --reload"]
