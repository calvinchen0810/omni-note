import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from contextlib import asynccontextmanager

from database import init_db
from routers import notebooks, pages, sticky_notes

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="OmniNote", lifespan=lifespan)

app.include_router(notebooks.router, prefix="/api")
app.include_router(pages.router, prefix="/api")
app.include_router(sticky_notes.router, prefix="/api")

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
