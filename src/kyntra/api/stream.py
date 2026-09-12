"""KYNTRA Live WebSocket Streaming API.

Provides real-time bi-directional streaming over WS /api/live for pit-wall
dashboards, delivering coherent race state, battle updates, window trajectories,
and race memory events.
"""

import asyncio
import json
from typing import Any, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from kyntra.services.live_service import get_live_race_service

stream_router = APIRouter(tags=["KYNTRA Live Stream"])


@stream_router.websocket("/live")
async def websocket_live_stream(websocket: WebSocket):
    """Real-time race intelligence WebSocket stream."""
    await websocket.accept()
    service = get_live_race_service()

    # Async queue to decouple background thread updates from WebSocket writer
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    loop = asyncio.get_running_loop()

    def subscriber_callback(payload: Dict[str, Any]) -> None:
        try:
            loop.call_soon_threadsafe(queue.put_nowait, payload)
        except Exception:
            pass

    service.subscribe(subscriber_callback)

    # Ensure service is actively ticking
    if not service._is_running:
        service.start()

    # Send initial snapshot immediately
    try:
        initial_payload = service.step()
        if initial_payload:
            await websocket.send_text(json.dumps(initial_payload))
    except Exception:
        pass

    async def sender():
        try:
            while True:
                payload = await queue.get()
                await websocket.send_text(json.dumps(payload))
                queue.task_done()
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

    sender_task = asyncio.create_task(sender())

    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                action = msg.get("action")

                if action == "pause":
                    service.provider.pause()
                elif action == "resume":
                    service.provider.resume()
                elif action == "seek":
                    lap = int(msg.get("lap", 1))
                    service.seek(lap)
                    service.step()
                elif action == "speed":
                    speed = float(msg.get("speed", 1.0))
                    service.provider.set_speed(speed)
                elif action == "set_event":
                    ev_id = str(msg.get("event_id", "2026_13_ITA"))
                    service.set_event(ev_id)
                elif action == "select_battle":
                    b_id = str(msg.get("battle_id", ""))
                    service.state_store.set_selected_battle_id(b_id)
                    service.step()
                elif action == "step":
                    service.step()
            except Exception:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        service.unsubscribe(subscriber_callback)
        sender_task.cancel()
