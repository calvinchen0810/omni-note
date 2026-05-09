from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Notebook(Base):
    __tablename__ = "notebooks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, default="Untitled Notebook")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    strokes_json = Column(Text, nullable=False, default="[]")
    background_json = Column(Text, nullable=False, default='{"type":"blank"}')
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
