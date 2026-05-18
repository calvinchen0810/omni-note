from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    reset_token = Column(String(64), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    notebooks = relationship("Notebook", back_populates="owner", cascade="all, delete-orphan")


class Notebook(Base):
    __tablename__ = "notebooks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String(255), nullable=False, default="Untitled Notebook")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="notebooks")
    pages = relationship(
        "Page",
        back_populates="notebook",
        cascade="all, delete-orphan",
        order_by="Page.page_index",
    )


class Page(Base):
    __tablename__ = "pages"

    id = Column(Integer, primary_key=True, index=True)
    notebook_id = Column(Integer, ForeignKey("notebooks.id"), nullable=False)
    page_index = Column(Integer, nullable=False, default=0)
    title = Column(String(255), nullable=True, default=None)
    strokes_json = Column(Text, nullable=False, default="[]")
    background_json = Column(Text, nullable=False, default='{"type":"blank"}')
    page_type = Column(String(20), nullable=False, default="handwriting")
    mindmap_json = Column(Text, nullable=False, default='{"nodes":[],"connections":[]}')
    background_image_data = Column(LargeBinary, nullable=True)
    background_image_mime = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    notebook = relationship("Notebook", back_populates="pages")
    sticky_notes = relationship(
        "StickyNote", back_populates="page", cascade="all, delete-orphan"
    )


class StickyNote(Base):
    __tablename__ = "sticky_notes"

    id = Column(Integer, primary_key=True, index=True)
    page_id = Column(Integer, ForeignKey("pages.id"), nullable=False)
    x = Column(Float, nullable=False, default=100)
    y = Column(Float, nullable=False, default=100)
    width = Column(Float, nullable=False, default=200)
    height = Column(Float, nullable=False, default=150)
    content = Column(Text, nullable=False, default="")
    color = Column(String(20), nullable=False, default="#ffd60a")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    page = relationship("Page", back_populates="sticky_notes")
