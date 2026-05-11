import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from contextlib import asynccontextmanager

from database import init_db, DATA_DIR
from routers import notebooks, pages, sticky_notes, cloud

STATIC_DIR = Path(__file__).resolve().parent / "static"
BACKGROUNDS_DIR = DATA_DIR / "backgrounds"


@asynccontextmanager
async def lifespan(app: FastAPI):
    BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)
    await init_db()
    yield


app = FastAPI(title="OmniNote", lifespan=lifespan)

app.include_router(notebooks.router, prefix="/api")
app.include_router(pages.router, prefix="/api")
app.include_router(sticky_notes.router, prefix="/api")
app.include_router(cloud.router, prefix="/api")

@app.get("/backgrounds/{page_id}")
async def get_background_image(page_id: int):
    path = BACKGROUNDS_DIR / str(page_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="No background image")
    # Read first 12 bytes to detect format
    header = path.read_bytes()[:12]
    if header[:4] == b"\x89PNG":
        mime = "image/png"
    elif header[:3] == b"\xff\xd8\xff":
        mime = "image/jpeg"
    elif header[:6] in (b"GIF87a", b"GIF89a"):
        mime = "image/gif"
    elif header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        mime = "application/octet-stream"
    return FileResponse(path, media_type=mime)


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
