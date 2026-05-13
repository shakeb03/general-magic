from fastapi import APIRouter

from app import state
from app.seed.load import load_seed
from app.scheduler.conversation_runner import restart_scheduler

router = APIRouter()


@router.post("/reset")
def reset_demo():
    load_seed()
    restart_scheduler()
    state.push_event("reset", {})
    return {"status": "ok", "message": "Demo state reset. Six conversations restarted."}


@router.get("/health")
def health():
    from app.scheduler.conversation_runner import scheduler
    return {
        "status": "ok",
        "scheduler_running": scheduler.running,
        "conversations": len(state.conversations),
        "messages": sum(len(v) for v in state.messages.values()),
        "ams_activities": len(state.ams_activities),
    }
