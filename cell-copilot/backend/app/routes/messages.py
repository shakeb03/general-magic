import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import state
from app.state import Message
from app.agent.pipeline import run_agent_pipeline, generate_suggest_reply

router = APIRouter()


class SendMessageRequest(BaseModel):
    content: str


@router.post("/conversations/{conv_id}/messages")
async def send_broker_message(conv_id: str, body: SendMessageRequest):
    conv = state.conversations.get(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        sender="broker",
        content=body.content,
        timestamp=datetime.now(timezone.utc),
    )
    state.messages[conv_id].append(msg)
    state.push_event("message", msg.model_dump(mode="json"))
    return msg.model_dump(mode="json")


@router.post("/conversations/{conv_id}/takeover")
def takeover(conv_id: str):
    conv = state.conversations.get(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    updated = conv.model_copy(update={"control": "broker"})
    state.conversations[conv_id] = updated
    state.push_event("conversation_updated", updated.model_dump(mode="json"))
    return {"status": "ok", "control": "broker"}


@router.post("/conversations/{conv_id}/handback")
async def handback(conv_id: str):
    conv = state.conversations.get(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    updated = conv.model_copy(update={"control": "agent"})
    state.conversations[conv_id] = updated
    state.push_event("conversation_updated", updated.model_dump(mode="json"))

    # Trigger agent to acknowledge handback and continue
    # Find the last customer message to use as context
    msgs = state.messages.get(conv_id, [])
    last_customer_msg = next(
        (m.content for m in reversed(msgs) if m.sender == "customer"), ""
    )
    if last_customer_msg:
        await run_agent_pipeline(conv_id, last_customer_msg, is_handback=True)

    return {"status": "ok", "control": "agent"}


@router.post("/conversations/{conv_id}/suggest")
async def suggest_reply(conv_id: str):
    conv = state.conversations.get(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    draft = await generate_suggest_reply(conv_id)
    return {"draft": draft}
