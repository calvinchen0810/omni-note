from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime
import json

from database import get_db
from models import Page, StickyNote

router = APIRouter()


class StrokesUpdate(BaseModel):
    strokes: list


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
    created_at: datetime
    updated_at: datetime


@router.get("/notebooks/{notebook_id}/pages", response_model=list[PageOut])
async def list_pages(notebook_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Page)
        .options(selectinload(Page.sticky_notes))
        .where(Page.notebook_id == notebook_id)
        .order_by(Page.page_index)
    )
    pages = result.scalars().all()
    return [
        PageOut(
            id=p.id,
            notebook_id=p.notebook_id,
            page_index=p.page_index,
            strokes=json.loads(p.strokes_json),
            sticky_notes=[StickyNoteOut.model_validate(sn) for sn in p.sticky_notes],
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in pages
    ]


@router.post("/notebooks/{notebook_id}/pages", response_model=PageOut)
async def create_page(notebook_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Page)
        .where(Page.notebook_id == notebook_id)
        .order_by(Page.page_index.desc())
    )
    last = result.scalars().first()
    next_index = (last.page_index + 1) if last else 0

    page = Page(notebook_id=notebook_id, page_index=next_index)
    db.add(page)
    await db.commit()
    await db.refresh(page)
    return PageOut(
        id=page.id,
        notebook_id=page.notebook_id,
        page_index=page.page_index,
        strokes=[],
        sticky_notes=[],
        created_at=page.created_at,
        updated_at=page.updated_at,
    )


@router.get("/pages/{page_id}", response_model=PageOut)
async def get_page(page_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Page).options(selectinload(Page.sticky_notes)).where(Page.id == page_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return PageOut(
        id=page.id,
        notebook_id=page.notebook_id,
        page_index=page.page_index,
        strokes=json.loads(page.strokes_json),
        sticky_notes=[StickyNoteOut.model_validate(sn) for sn in page.sticky_notes],
        created_at=page.created_at,
        updated_at=page.updated_at,
    )


@router.put("/pages/{page_id}/strokes")
async def update_strokes(
    page_id: int, body: StrokesUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Page).where(Page.id == page_id))
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page.strokes_json = json.dumps(body.strokes)
    page.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.delete("/pages/{page_id}")
async def delete_page(page_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Page).options(selectinload(Page.sticky_notes)).where(Page.id == page_id)
    )
    page = result.scalar_one_or_none()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    nb_result = await db.execute(
        select(Page)
        .where(Page.notebook_id == page.notebook_id, Page.id != page_id)
        .order_by(Page.page_index)
    )
    remaining = nb_result.scalars().all()
    for i, p in enumerate(remaining):
        p.page_index = i

    await db.delete(page)
    await db.commit()
    return {"ok": True}
