import hashlib
import json
import secrets
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import CloudProject

router = APIRouter(prefix="/cloud", tags=["cloud"])


def _hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _gen_id() -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(6))


class SaveRequest(BaseModel):
    id: Optional[str] = None
    name: str
    password: str
    data: dict


class OpenRequest(BaseModel):
    id: str
    password: str


@router.post("/save")
async def cloud_save(req: SaveRequest, db: AsyncSession = Depends(get_db)):
    pw_hash = _hash_pw(req.password)
    data_str = json.dumps(req.data)

    if req.id:
        result = await db.execute(select(CloudProject).where(CloudProject.id == req.id))
        proj = result.scalar_one_or_none()
        if not proj:
            raise HTTPException(404, "找不到此專案")
        if proj.password_hash != pw_hash:
            raise HTTPException(403, "密碼錯誤")
        proj.name = req.name
        proj.data_json = data_str
        proj.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(proj)
        return {"id": proj.id, "updated_at": proj.updated_at.isoformat()}

    # Create new — guarantee unique ID
    proj_id = _gen_id()
    for _ in range(10):
        r = await db.execute(select(CloudProject).where(CloudProject.id == proj_id))
        if not r.scalar_one_or_none():
            break
        proj_id = _gen_id()

    proj = CloudProject(
        id=proj_id,
        name=req.name,
        password_hash=pw_hash,
        data_json=data_str,
    )
    db.add(proj)
    await db.commit()
    await db.refresh(proj)
    return {"id": proj.id, "updated_at": proj.updated_at.isoformat()}


@router.post("/open")
async def cloud_open(req: OpenRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloudProject).where(CloudProject.id == req.id))
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(404, "找不到此專案")
    if proj.password_hash != _hash_pw(req.password):
        raise HTTPException(403, "密碼錯誤")
    return {
        "id": proj.id,
        "name": proj.name,
        "data": json.loads(proj.data_json),
        "updated_at": proj.updated_at.isoformat(),
    }


@router.post("/meta")
async def cloud_meta(req: OpenRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CloudProject).where(CloudProject.id == req.id))
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(404, "找不到此專案")
    if proj.password_hash != _hash_pw(req.password):
        raise HTTPException(403, "密碼錯誤")
    return {"updated_at": proj.updated_at.isoformat()}
