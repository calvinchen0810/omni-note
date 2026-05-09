from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime
from pathlib import Path
import json

from database import get_db, DATA_DIR
from models import Page, StickyNote

router = APIRouter()

BACKGROUNDS_DIR = DATA_DIR / "backgrounds"
ALLOWED_MIME = {"image/jpeg", "image/png", "image/gif", "image/webp"}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_page(page_id: int, db: AsyncSession) -> Page:
    result = await db.execute(
        select(Page).options(selectinload(Page.sticky_notes)).where(Page.id == page_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page


def _bg_file(page_id: int) -> Path:
    return BACKGROUNDS_DIR / str(page_id)


def _delete_bg_file(page_id: int):
    p = _bg_file(page_id)
    if p.exists():
        p.unlink()


# ── Schemas ───────────────────────────────────────────────────────────────────

class StrokesUpdate(BaseModel):
    strokes: list


class BackgroundUpdate(BaseModel):
    type: str = "blank"
    spacing: float | None = None
    thickness: float | None = None
    size: float | None = None
    scale: float | None = None
    ts: int | None = None


class PageCreate(BaseModel):
    background: dict | None = None


class StickyNoteOut(BaseModel):
    id: int
    page_id: int
    x: float
    y: float
    width: float
    height: float
    content: str
    color: str

    class Config:
        from_attributes = True


class PageOut(BaseModel):
    id: int
    notebook_id: int
    page_index: int
    strokes: list
    sticky_notes: list[StickyNoteOut]
    background: dict
    created_at: datetime
    updated_at: datetime


def _page_out(p: Page) -> PageOut:
    return PageOut(
        id=p.id,
        notebook_id=p.notebook_id,
        page_index=p.page_index,
        strokes=json.loads(p.strokes_json),
        sticky_notes=[StickyNoteOut.model_validate(sn) for sn in p.sticky_notes],
        background=json.loads(p.background_json or '{"type":"blank"}'),
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


# ── List / Get ────────────────────────────────────────────────────────────────

@router.get("/notebooks/{notebook_id}/pages", response_model=list[PageOut])
async def list_pages(notebook_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Page)
        .options(selectinload(Page.sticky_notes))
        .where(Page.notebook_id == notebook_id)
        .order_by(Page.page_index)
    )
    return [_page_out(p) for p in result.scalars().all()]


@router.get("/pages/{page_id}", response_model=PageOut)
async def get_page(page_id: int, db: AsyncSession = Depends(get_db)):
    return _page_out(await _get_page(page_id, db))


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("/notebooks/{notebook_id}/pages", response_model=PageOut)
async def create_page(
    notebook_id: int,
    body: PageCreate = PageCreate(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Page)
        .where(Page.notebook_id == notebook_id)
        .order_by(Page.page_index.desc())
    )
    last = result.scalars().first()
    next_index = (last.page_index + 1) if last else 0

    # Inherit background but strip image type (image file isn't copied)
    bg = body.background or {"type": "blank"}
    if bg.get("type") == "image":
        bg = {"type": "blank"}

    page = Page(
        notebook_id=notebook_id,
        page_index=next_index,
        background_json=json.dumps(bg),
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)
    page.sticky_notes = []
    return _page_out(page)


# ── Update strokes ────────────────────────────────────────────────────────────

@router.put("/pages/{page_id}/strokes")
async def update_strokes(
    page_id: int, body: StrokesUpdate, db: AsyncSession = Depends(get_db)
):
    page = await _get_page(page_id, db)
    page.strokes_json = json.dumps(body.strokes)
    page.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


# ── Update background ─────────────────────────────────────────────────────────

@router.put("/pages/{page_id}/background")
async def update_background(
    page_id: int, body: BackgroundUpdate, db: AsyncSession = Depends(get_db)
):
    page = await _get_page(page_id, db)
    bg = body.model_dump(exclude_none=True)
    page.background_json = json.dumps(bg)
    page.updated_at = datetime.utcnow()
    await db.commit()
    return {"background": bg}


# ── Upload background image ───────────────────────────────────────────────────

@router.post("/pages/{page_id}/background-image")
async def upload_background_image(
    page_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    page = await _get_page(page_id, db)

    BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    _bg_file(page_id).write_bytes(content)

    # Preserve existing scale if background was already an image
    current = json.loads(page.background_json or '{"type":"blank"}')
    scale = current.get("scale", 1.0) if current.get("type") == "image" else 1.0

    bg = {"type": "image", "scale": scale, "ts": int(datetime.utcnow().timestamp() * 1000)}
    page.background_json = json.dumps(bg)
    page.updated_at = datetime.utcnow()
    await db.commit()

    return {"background": bg}


# ── Delete background image ───────────────────────────────────────────────────

@router.delete("/pages/{page_id}/background-image")
async def delete_background_image(
    page_id: int, db: AsyncSession = Depends(get_db)
):
    page = await _get_page(page_id, db)
    _delete_bg_file(page_id)
    page.background_json = '{"type":"blank"}'
    page.updated_at = datetime.utcnow()
    await db.commit()
    return {"background": {"type": "blank"}}


# ── Delete page ───────────────────────────────────────────────────────────────

@router.delete("/pages/{page_id}")
async def delete_page(page_id: int, db: AsyncSession = Depends(get_db)):
    page = await _get_page(page_id, db)

    nb_result = await db.execute(
        select(Page)
        .where(Page.notebook_id == page.notebook_id, Page.id != page_id)
        .order_by(Page.page_index)
    )
    remaining = nb_result.scalars().all()
    for i, p in enumerate(remaining):
        p.page_index = i

    _delete_bg_file(page_id)
    await db.delete(page)
    await db.commit()
    return {"ok": True}
