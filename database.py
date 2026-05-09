from pathlib import Path
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import text

APP_ROOT = Path(__file__).resolve().parent.parent   # apps/{name}/
DATA_DIR = APP_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = Path(os.getenv("DB_PATH", str(DATA_DIR / "db.sqlite")))

DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migration: add background_json if missing
        try:
            await conn.execute(text(
                "ALTER TABLE pages ADD COLUMN background_json TEXT NOT NULL DEFAULT '{\"type\":\"blank\"}'"
            ))
        except Exception:
            pass  # column already exists
