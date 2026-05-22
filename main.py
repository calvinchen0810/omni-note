import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import init_db, get_db
from models import Page
from routers import notebooks, pages, sticky_notes, auth as auth_router, ws_relay

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="OmniNote", lifespan=lifespan)

app.include_router(auth_router.router, prefix="/api")
app.include_router(notebooks.router, prefix="/api")
app.include_router(pages.router, prefix="/api")
app.include_router(sticky_notes.router, prefix="/api")
app.include_router(ws_relay.router)  # /ws (WebSocket) + /api/ws/* (admin)

@app.get("/backgrounds/{page_id}")
async def get_background_image(page_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Page.background_image_data, Page.background_image_mime).where(Page.id == page_id))
    row = result.first()
    if not row or not row.background_image_data:
        raise HTTPException(status_code=404, detail="No background image")
    mime = row.background_image_mime or "application/octet-stream"
    return Response(content=bytes(row.background_image_data), media_type=mime)


@app.get("/health")
def health():
    return Response(content="OK", status_code=200)

@app.head("/health")
def health_check_head():
    return Response(status_code=200)

@app.get("/sw.js")
async def service_worker():
    return FileResponse(STATIC_DIR / "sw.js", media_type="application/javascript")


@app.get("/manifest.json")
async def manifest():
    return FileResponse(STATIC_DIR / "manifest.json")


# Mount static; html=True serves index.html as SPA fallback
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
