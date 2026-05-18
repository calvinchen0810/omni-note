from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timedelta

from database import get_db
from models import User
from auth import (
    hash_password, verify_password, create_access_token,
    generate_reset_token, hash_reset_token, get_current_user,
    RESET_TOKEN_EXPIRE_HOURS,
)

router = APIRouter(prefix="/auth")


class RegisterBody(BaseModel):
    username: str
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


class ForgotPasswordBody(BaseModel):
    email: str


class ResetPasswordBody(BaseModel):
    token: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    token: str
    user: UserOut


@router.post("/register", response_model=TokenOut)
async def register(body: RegisterBody, db: AsyncSession = Depends(get_db)):
    username = body.username.strip()
    email = body.email.strip().lower()

    if len(username) < 2:
        raise HTTPException(status_code=400, detail="Username must be at least 2 characters")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email address")

    result = await db.execute(
        select(User).where((User.email == email) | (User.username == username))
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email or username already taken")

    user = User(username=username, email=email, hashed_password=hash_password(body.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenOut(token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.strip().lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    return TokenOut(token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email.strip().lower()))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email")

    plain_token, hashed_token = generate_reset_token()
    user.reset_token = hashed_token
    user.reset_token_expires = datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)
    await db.commit()

    return {
        "reset_token": plain_token,
        "expires_in_hours": RESET_TOKEN_EXPIRE_HOURS,
    }


@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody, db: AsyncSession = Depends(get_db)):
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    hashed = hash_reset_token(body.token.strip())
    result = await db.execute(
        select(User).where(
            User.reset_token == hashed,
            User.reset_token_expires > datetime.utcnow(),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.hashed_password = hash_password(body.password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()

    return {"ok": True}
