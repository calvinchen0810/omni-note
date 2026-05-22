import asyncio
import json
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from pydantic import BaseModel

from database import get_db, DATA_DIR
from auth import get_current_user

# ── Config persistence ────────────────────────────────────────────────────────

CONFIG_FILE = DATA_DIR / "ws_config.json"
ROOM_TIMEOUT = 600  # 10 minutes


def _load_config() -> dict:
    if CONFIG_FILE.exists():
        return json.loads(CONFIG_FILE.read_text())
    return {"allowed_origins": []}


def _save_config(cfg: dict):
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2))


def _ts() -> int:
    return int(time.time() * 1000)


# ── Room & ConnectionManager ──────────────────────────────────────────────────

class Room:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.connections: list[tuple[WebSocket, str]] = []  # (ws, username)
        self.last_activity: float = time.time()
        self.closed: bool = False
        self.created_at: float = time.time()
        self._task: Optional[asyncio.Task] = None

    def touch(self):
        self.last_activity = time.time()

    def start_timer(self):
        if self._task:
            self._task.cancel()
        self._task = asyncio.create_task(self._watch())

    async def _watch(self):
        try:
            while not self.closed:
                await asyncio.sleep(30)
                if time.time() - self.last_activity >= ROOM_TIMEOUT:
                    await self.expire("timeout")
                    break
        except asyncio.CancelledError:
            pass

    async def expire(self, reason: str = "timeout"):
        if self.closed:
            return
        self.closed = True
        msg = {"type": "room_closed", "sender": "system",
               "payload": {"reason": reason}, "ts": _ts()}
        for ws, _ in list(self.connections):
            try:
                await ws.send_json(msg)
                await ws.close(1000)
            except Exception:
                pass
        self.connections.clear()
        manager.rooms.pop(self.room_id, None)
        manager.dead_rooms.add(self.room_id)

    async def broadcast(self, msg: dict, sender_ws: WebSocket):
        self.touch()
        for ws, _ in list(self.connections):
            if ws is not sender_ws:
                try:
                    await ws.send_json(msg)
                except Exception:
                    pass

    def info(self) -> dict:
        return {
            "room_id": self.room_id,
            "users": [u for _, u in self.connections],
            "connections": len(self.connections),
            "last_activity": self.last_activity,
            "idle_seconds": round(time.time() - self.last_activity),
            "expires_in": max(0, round(ROOM_TIMEOUT - (time.time() - self.last_activity))),
            "created_at": self.created_at,
        }


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, Room] = {}
        self.dead_rooms: set[str] = set()

    def get_room(self, room_id: str) -> Optional[Room]:
        if room_id in self.dead_rooms:
            return None
        return self.rooms.get(room_id)

    def get_or_create(self, room_id: str) -> Optional[Room]:
        if room_id in self.dead_rooms:
            return None
        if room_id not in self.rooms:
            self.rooms[room_id] = Room(room_id)
        return self.rooms[room_id]

    def status(self) -> dict:
        return {
            "active_rooms": len(self.rooms),
            "total_connections": sum(len(r.connections) for r in self.rooms.values()),
            "rooms": [r.info() for r in self.rooms.values()],
        }


manager = ConnectionManager()

# ── Router ────────────────────────────────────────────────────────────────────

router = APIRouter()       # admin REST under /api/ws/*
ws_router = APIRouter()    # WebSocket at /ws


@ws_router.websocket("/ws")
async def ws_endpoint(
    websocket: WebSocket,
    room: str = Query(..., min_length=4, max_length=128),
    user: str = Query("Anonymous", max_length=32),
):
    # Origin check
    cfg = _load_config()
    allowed = cfg.get("allowed_origins", [])
    origin = websocket.headers.get("origin", "")
    if allowed and origin not in allowed:
        await websocket.close(code=4001, reason="Origin not allowed")
        return

    # Room checks
    room_obj = manager.get_or_create(room)
    if room_obj is None:
        await websocket.close(code=4002, reason="Room expired or invalid")
        return
    if len(room_obj.connections) >= 2:
        await websocket.close(code=4003, reason="Room is full")
        return

    await websocket.accept()
    room_obj.connections.append((websocket, user))
    room_obj.touch()
    room_obj.start_timer()

    # Notify peer
    await room_obj.broadcast(
        {"type": "user_joined", "sender": "system",
         "payload": {"user": user}, "ts": _ts()},
        sender_ws=websocket,
    )

    try:
        while True:
            data = await websocket.receive_json()
            msg = {
                "type": data.get("type", "message"),
                "payload": data.get("payload"),
                "sender": user,
                "ts": _ts(),
            }
            await room_obj.broadcast(msg, sender_ws=websocket)
    except (WebSocketDisconnect, Exception):
        room_obj.connections = [(ws, u) for ws, u in room_obj.connections if ws is not websocket]
        room_obj.touch()
        room_obj.start_timer()
        await room_obj.broadcast(
            {"type": "user_left", "sender": "system",
             "payload": {"user": user}, "ts": _ts()},
            sender_ws=websocket,
        )
        # If room is empty, mark as dead immediately
        if not room_obj.connections:
            await room_obj.expire("empty")


# ── Admin API ─────────────────────────────────────────────────────────────────

@router.get("/status")
async def ws_status(current_user=Depends(get_current_user)):
    return manager.status()


@router.get("/config")
async def ws_config(current_user=Depends(get_current_user)):
    return _load_config()


class WsConfigUpdate(BaseModel):
    allowed_origins: list[str]


@router.put("/config")
async def ws_config_update(body: WsConfigUpdate, current_user=Depends(get_current_user)):
    cfg = {"allowed_origins": [o.rstrip("/") for o in body.allowed_origins if o.strip()]}
    _save_config(cfg)
    return cfg
