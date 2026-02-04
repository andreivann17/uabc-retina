from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..realtime.ws_manager import detections_manager, monitor_manager

router = APIRouter(prefix="/ws", tags=["ws"])


@router.websocket("/detections")
async def ws_detections(ws: WebSocket):
    await detections_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        detections_manager.disconnect(ws)


@router.websocket("/monitor")
async def ws_monitor(ws: WebSocket):
    await monitor_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        monitor_manager.disconnect(ws)
