from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

from database import get_db
from models import StickyNote

router = APIRouter()


class StickyNoteCreate(BaseModel):
    x: float = 100
    y: float = 100
    width: float = 200
    height: float = 150
    content: str = ""
    color: str = "#ffd60a"


class StickyNoteUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    content: Optional[str] = None
    color: Optional[str] = None


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


@router.post("/pages/{page_id}/sticky-notes", response_model=StickyNoteOut)
async def create_sticky_note(
    page_id: int, body: StickyNoteCreate, db: AsyncSession = Depends(get_db)
):
    sn = StickyNote(
        page_id=page_id,
        x=body.x,
        y=body.y,
        width=body.width,
        height=body.height,
        content=body.content,
        color=body.color,
    )
    db.add(sn)
    await db.commit()
    await db.refresh(sn)
    return sn


@router.put("/sticky-notes/{note_id}", response_model=StickyNoteOut)
async def update_sticky_note(
    note_id: int, body: StickyNoteUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(StickyNote).where(StickyNote.id == note_id))
    sn = result.scalar_one_or_none()
    if not sn:
        raise HTTPException(status_code=404, detail="Sticky note not found")
    for field in ("x", "y", "width", "height", "content", "color"):
        val = getattr(body, field)
        if val is not None:
            setattr(sn, field, val)
    sn.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(sn)
    return sn


@router.delete("/sticky-notes/{note_id}")
async def delete_sticky_note(note_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StickyNote).where(StickyNote.id == note_id))
    sn = result.scalar_one_or_none()
    if not sn:
        raise HTTPException(status_code=404, detail="Sticky note not found")
    await db.delete(sn)
    await db.commit()
    return {"ok": True}
