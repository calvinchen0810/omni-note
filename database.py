from pathlib import Path
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import text

# Backgrounds are still stored on the filesystem
APP_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(APP_ROOT / "data")))
DATA_DIR.mkdir(exist_ok=True)

# Accept postgres:// or postgresql:// and rewrite to asyncpg driver URL
_raw_url = os.environ["DATABASE_URL"]
if _raw_url.startswith("postgres://"):
    _raw_url = "postgresql+asyncpg://" + _raw_url[len("postgres://"):]
elif _raw_url.startswith("postgresql://"):
    _raw_url = "postgresql+asyncpg://" + _raw_url[len("postgresql://"):]
elif not _raw_url.startswith("postgresql+asyncpg://"):
    raise ValueError(f"Unsupported DATABASE_URL scheme: {_raw_url}")

DATABASE_URL = _raw_url

engine = create_async_engine(DATABASE_URL, echo=False)
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
        ]
        for sql in migrations:
            await conn.execute(text(sql))
