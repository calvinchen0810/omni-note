from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import Notebook, Page

router = APIRouter()


class NotebookCreate(BaseModel):
    title: str = "Untitled Notebook"


class NotebookUpdate(BaseModel):
    title: str


class NotebookOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    page_count: int = 0

    class Config:
        from_attributes = True


@router.get("/notebooks", response_model=list[NotebookOut])
async def list_notebooks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notebook)
        .options(selectinload(Notebook.pages))
        .order_by(Notebook.updated_at.desc())
    )
    notebooks = result.scalars().all()
    return [
        NotebookOut(
            id=nb.id,
            title=nb.title,
            created_at=nb.created_at,
            updated_at=nb.updated_at,
            page_count=len(nb.pages),
        )
        for nb in notebooks
    ]


@router.post("/notebooks", response_model=NotebookOut)
async def create_notebook(body: NotebookCreate, db: AsyncSession = Depends(get_db)):
    nb = Notebook(title=body.title)
    db.add(nb)
    await db.flush()
    page = Page(notebook_id=nb.id, page_index=0)
    db.add(page)
    await db.commit()
    await db.refresh(nb)
    return NotebookOut(
        id=nb.id,
        title=nb.title,
        created_at=nb.created_at,
        updated_at=nb.updated_at,
        page_count=1,
    )


@router.get("/notebooks/{notebook_id}", response_model=NotebookOut)
async def get_notebook(notebook_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notebook)
        .options(selectinload(Notebook.pages))
        .where(Notebook.id == notebook_id)
    )
    nb = result.scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return NotebookOut(
        id=nb.id,
        title=nb.title,
        created_at=nb.created_at,
        updated_at=nb.updated_at,
        page_count=len(nb.pages),
    )


@router.put("/notebooks/{notebook_id}", response_model=NotebookOut)
async def update_notebook(
    notebook_id: int, body: NotebookUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Notebook)
        .options(selectinload(Notebook.pages))
        .where(Notebook.id == notebook_id)
    )
    nb = result.scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    nb.title = body.title
    nb.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(nb)
    return NotebookOut(
        id=nb.id,
        title=nb.title,
        created_at=nb.created_at,
        updated_at=nb.updated_at,
        page_count=len(nb.pages),
    )


@router.delete("/notebooks/{notebook_id}")
async def delete_notebook(notebook_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notebook).where(Notebook.id == notebook_id))
    nb = result.scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    await db.delete(nb)
    await db.commit()
    return {"ok": True}
