from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import text

APP_ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(APP_ROOT / "data")))
DATA_DIR.mkdir(exist_ok=True)

# ── Build engine URL ──────────────────────────────────────────────────────────

_raw = os.getenv("DATABASE_URL")

if not _raw:
    # Local development: fall back to SQLite
    _db_file = DATA_DIR / "omninote.db"
    DATABASE_URL = f"sqlite+aiosqlite:///{_db_file}"
    _connect_args = {}
    _is_sqlite = True
else:
    _is_sqlite = False
    # Rewrite scheme to asyncpg driver
    if _raw.startswith("postgres://"):
        _raw = "postgresql+asyncpg://" + _raw[len("postgres://"):]
    elif _raw.startswith("postgresql://"):
        _raw = "postgresql+asyncpg://" + _raw[len("postgresql://"):]
    elif not _raw.startswith("postgresql+asyncpg://"):
        raise ValueError(f"Unsupported DATABASE_URL scheme: {_raw}")

    # Strip query parameters asyncpg doesn't understand; extract sslmode
    _parsed = urlparse(_raw)
    _params  = {k: v[0] for k, v in parse_qs(_parsed.query, keep_blank_values=True).items()}
    _sslmode = _params.pop("sslmode", "disable")
    _params.pop("channel_binding", None)   # Neon sends this; asyncpg rejects it
    _clean_url = urlunparse(_parsed._replace(query=urlencode(_params)))

    _connect_args = {}
    if _sslmode in ("require", "verify-ca", "verify-full"):
        _connect_args["ssl"] = "require"

    DATABASE_URL = _clean_url

# ── Engine ────────────────────────────────────────────────────────────────────

engine = create_async_engine(DATABASE_URL, connect_args=_connect_args, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        if _is_sqlite:
            # WAL mode: allows concurrent reads while writing; writes visible immediately
            await conn.execute(text("PRAGMA journal_mode=WAL"))
            await conn.execute(text("PRAGMA synchronous=NORMAL"))

            # SQLite: create_all already reflects the current model definition.
            # Run lightweight idempotent migrations for any pre-existing DB files.
            sqlite_migrations = [
                "ALTER TABLE pages ADD COLUMN background_json TEXT NOT NULL DEFAULT '{\"type\":\"blank\"}'",
                "ALTER TABLE pages ADD COLUMN page_type TEXT NOT NULL DEFAULT 'handwriting'",
                "ALTER TABLE pages ADD COLUMN mindmap_json TEXT NOT NULL DEFAULT '{\"nodes\":[],\"connections\":[]}'",
                "ALTER TABLE pages ADD COLUMN title TEXT",
                "ALTER TABLE pages ADD COLUMN background_image_data BLOB",
                "ALTER TABLE pages ADD COLUMN background_image_mime VARCHAR(50)",
                "ALTER TABLE notebooks ADD COLUMN user_id INTEGER REFERENCES users(id)",
            ]
            for sql in sqlite_migrations:
                try:
                    await conn.execute(text(sql))
                except Exception:
                    pass  # column already exists — harmless
        else:
            # PostgreSQL: idempotent migrations with IF NOT EXISTS
            pg_migrations = [
                "ALTER TABLE pages ADD COLUMN IF NOT EXISTS background_json TEXT NOT NULL DEFAULT '{\"type\":\"blank\"}'",
                "ALTER TABLE pages ADD COLUMN IF NOT EXISTS page_type TEXT NOT NULL DEFAULT 'handwriting'",
                "ALTER TABLE pages ADD COLUMN IF NOT EXISTS mindmap_json TEXT NOT NULL DEFAULT '{\"nodes\":[],\"connections\":[]}'",
                "ALTER TABLE pages ADD COLUMN IF NOT EXISTS title TEXT",
                "ALTER TABLE pages ADD COLUMN IF NOT EXISTS background_image_data BYTEA",
                "ALTER TABLE pages ADD COLUMN IF NOT EXISTS background_image_mime VARCHAR(50)",
                "ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
            ]
            for sql in pg_migrations:
                await conn.execute(text(sql))
