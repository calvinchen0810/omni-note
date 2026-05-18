from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import text

APP_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(APP_ROOT / "data")))
DATA_DIR.mkdir(exist_ok=True)

# ── Parse and normalise DATABASE_URL ─────────────────────────────────────────

_raw = os.environ["DATABASE_URL"]

# Rewrite scheme to asyncpg driver
if _raw.startswith("postgres://"):
    _raw = "postgresql+asyncpg://" + _raw[len("postgres://"):]
elif _raw.startswith("postgresql://"):
    _raw = "postgresql+asyncpg://" + _raw[len("postgresql://"):]
elif not _raw.startswith("postgresql+asyncpg://"):
    raise ValueError(f"Unsupported DATABASE_URL scheme: {_raw}")

# Strip query parameters that asyncpg does not understand (e.g. channel_binding)
# and extract sslmode so we can pass it via connect_args instead.
_parsed = urlparse(_raw)
_params  = {k: v[0] for k, v in parse_qs(_parsed.query, keep_blank_values=True).items()}

_sslmode = _params.pop("sslmode", "disable")
_params.pop("channel_binding", None)          # Neon sends this; asyncpg rejects it

_clean_url = urlunparse(_parsed._replace(query=urlencode(_params)))

# Build connect_args for SSL
_connect_args = {}
if _sslmode in ("require", "verify-ca", "verify-full"):
    _connect_args["ssl"] = "require"

# ── Engine ────────────────────────────────────────────────────────────────────

DATABASE_URL = _clean_url

engine = create_async_engine(DATABASE_URL, connect_args=_connect_args, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent column migrations (PostgreSQL supports IF NOT EXISTS)
        migrations = [
            "ALTER TABLE pages ADD COLUMN IF NOT EXISTS background_json TEXT NOT NULL DEFAULT '{\"type\":\"blank\"}'",
            "ALTER TABLE pages ADD COLUMN IF NOT EXISTS page_type TEXT NOT NULL DEFAULT 'handwriting'",
            "ALTER TABLE pages ADD COLUMN IF NOT EXISTS mindmap_json TEXT NOT NULL DEFAULT '{\"nodes\":[],\"connections\":[]}'",
            "ALTER TABLE pages ADD COLUMN IF NOT EXISTS title TEXT",
            "ALTER TABLE pages ADD COLUMN IF NOT EXISTS background_image_data BYTEA",
            "ALTER TABLE pages ADD COLUMN IF NOT EXISTS background_image_mime VARCHAR(50)",
            # Auth migrations
            "ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
        ]
        for sql in migrations:
            await conn.execute(text(sql))
