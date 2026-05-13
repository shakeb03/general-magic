import asyncio
import json
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app import state

router = APIRouter()
logger = logging.getLogger(__name__)


async def _event_generator(queue: asyncio.Queue):
    try:
        # Send initial snapshot so client can hydrate state immediately
        snapshot = {
            "type": "snapshot",
            "data": {
                "conversations": [c.model_dump(mode="json") for c in state.conversations.values()],
                "messages": {
                    conv_id: [m.model_dump(mode="json") for m in msgs]
                    for conv_id, msgs in state.messages.items()
                },
                "flags": [f.model_dump(mode="json") for f in state.flags.values()],
                "opportunities": [o.model_dump(mode="json") for o in state.opportunities.values()],
                "ams_activities": [a.model_dump(mode="json") for a in state.ams_activities.values()],
            }
        }
        yield f"data: {json.dumps(snapshot)}\n\n"

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Keep-alive ping
                yield ": ping\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        state.unsubscribe(queue)


@router.get("/stream")
async def stream_events():
    queue = state.subscribe()
    return StreamingResponse(
        _event_generator(queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
