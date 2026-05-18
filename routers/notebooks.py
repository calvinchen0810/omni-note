from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime

from database import get_db, DATA_DIR
from models import Notebook, Page, User
from auth import get_current_user, get_optional_user

BACKGROUNDS_DIR = DATA_DIR / "backgrounds"

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

    model_config = {"from_attributes": True}


def _check_owner(nb: Notebook, user: User):
    if nb.user_id is not None and nb.user_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/notebooks", response_model=list[NotebookOut])
async def list_notebooks(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_optional_user),
):
    if current_user:
        condition = or_(Notebook.user_id == current_user.id, Notebook.user_id.is_(None))
    else:
        condition = Notebook.user_id.is_(None)

    result = await db.execute(
        select(Notebook)
        .options(selectinload(Notebook.pages))
        .where(condition)
        .order_by(Notebook.updated_at.desc())
    )
    notebooks = result.scalars().all()
    return [
        NotebookOut(
            id=nb.id, title=nb.title,
            created_at=nb.created_at, updated_at=nb.updated_at,
            page_count=len(nb.pages),
        )
        for nb in notebooks
    ]


@router.post("/notebooks", response_model=NotebookOut)
async def create_notebook(
    body: NotebookCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_optional_user),
):
    nb = Notebook(title=body.title, user_id=current_user.id if current_user else None)
    db.add(nb)
    await db.flush()
    page = Page(notebook_id=nb.id, page_index=0)
    db.add(page)
    await db.commit()
    await db.refresh(nb)
    return NotebookOut(
        id=nb.id, title=nb.title,
        created_at=nb.created_at, updated_at=nb.updated_at,
        page_count=1,
    )


@router.get("/notebooks/{notebook_id}", response_model=NotebookOut)
async def get_notebook(
    notebook_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_optional_user),
):
    result = await db.execute(
        select(Notebook).options(selectinload(Notebook.pages)).where(Notebook.id == notebook_id)
    )
    nb = result.scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if current_user:
        _check_owner(nb, current_user)
    return NotebookOut(
        id=nb.id, title=nb.title,
        created_at=nb.created_at, updated_at=nb.updated_at,
        page_count=len(nb.pages),
    )


@router.put("/notebooks/{notebook_id}", response_model=NotebookOut)
async def update_notebook(
    notebook_id: int,
    body: NotebookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_optional_user),
):
    result = await db.execute(
        select(Notebook).options(selectinload(Notebook.pages)).where(Notebook.id == notebook_id)
    )
    nb = result.scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if current_user:
        _check_owner(nb, current_user)
    nb.title = body.title
    nb.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(nb)
    return NotebookOut(
        id=nb.id, title=nb.title,
        created_at=nb.created_at, updated_at=nb.updated_at,
        page_count=len(nb.pages),
    )


@router.delete("/notebooks/{notebook_id}")
async def delete_notebook(
    notebook_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_optional_user),
):
    result = await db.execute(
        select(Notebook).options(selectinload(Notebook.pages)).where(Notebook.id == notebook_id)
    )
    nb = result.scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if current_user:
        _check_owner(nb, current_user)
    for page in nb.pages:
        bg_file = BACKGROUNDS_DIR / str(page.id)
        if bg_file.exists():
            bg_file.unlink()
    await db.delete(nb)
    await db.commit()
    return {"ok": True}
