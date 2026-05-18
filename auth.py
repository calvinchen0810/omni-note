import os
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from itsdangerous import TimestampSigner, SignatureExpired, BadSignature
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db

SECRET_KEY = os.getenv("SECRET_KEY", "omni-note-dev-secret-please-change-in-production")
ACCESS_TOKEN_MAX_AGE = 30 * 24 * 3600   # 30 days in seconds
RESET_TOKEN_EXPIRE_HOURS = 1

_signer = TimestampSigner(SECRET_KEY)
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: int) -> str:
    return _signer.sign(str(user_id)).decode()


def decode_access_token(token: str) -> Optional[int]:
    try:
        val = _signer.unsign(token, max_age=ACCESS_TOKEN_MAX_AGE)
        return int(val)
    except (SignatureExpired, BadSignature, ValueError):
        return None


def generate_reset_token() -> tuple[str, str]:
    """Returns (plain_token, hashed_token). Store only the hash."""
    token = secrets.token_urlsafe(32)
    hashed = hashlib.sha256(token.encode()).hexdigest()
    return token, hashed


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    from models import User
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Returns the current user, or None for unauthenticated (guest) requests."""
    from models import User
    if not credentials:
        return None
    user_id = decode_access_token(credentials.credentials)
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
