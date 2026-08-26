"""In-memory broadcast hub for the live transaction/risk stream. One process, one
manager — no external pub/sub broker needed at this scale."""
import asyncio

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._background_tasks: set[asyncio.Task] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, message: dict) -> None:
        async with self._lock:
            targets = list(self._connections)
        for websocket in targets:
            try:
                await websocket.send_json(message)
            except Exception:
                await self.disconnect(websocket)

    def broadcast_nowait(self, message: dict) -> None:
        """Schedules the broadcast without blocking the caller — used from /predict so a
        slow or dead WebSocket client can never delay the HTTP response."""
        task = asyncio.create_task(self.broadcast(message))
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)


manager = ConnectionManager()
