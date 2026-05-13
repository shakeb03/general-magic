from fastapi import APIRouter, HTTPException

from app import state

router = APIRouter()


@router.get("/conversations")
def list_conversations():
    return list(c.model_dump(mode="json") for c in state.conversations.values())


@router.get("/conversations/{conv_id}")
def get_conversation(conv_id: str):
    conv = state.conversations.get(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.model_dump(mode="json")


@router.get("/conversations/{conv_id}/messages")
def get_messages(conv_id: str):
    msgs = state.messages.get(conv_id, [])
    return [m.model_dump(mode="json") for m in msgs]


@router.get("/ams_activities")
def list_ams_activities():
    activities = sorted(
        state.ams_activities.values(),
        key=lambda a: a.timestamp,
        reverse=True,
    )
    return [a.model_dump(mode="json") for a in activities]


@router.get("/opportunities")
def list_opportunities():
    opps = sorted(
        state.opportunities.values(),
        key=lambda o: o.created_at,
        reverse=True,
    )
    return [o.model_dump(mode="json") for o in opps]


@router.get("/flags")
def list_flags():
    flags = sorted(
        state.flags.values(),
        key=lambda f: f.created_at,
        reverse=True,
    )
    return [f.model_dump(mode="json") for f in flags]
