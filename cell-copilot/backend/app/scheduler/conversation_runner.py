import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app import state
from app.agent.pipeline import run_agent_pipeline

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# Seconds between customer messages per conversation (jitter ±2s added by APScheduler)
CONV_INTERVALS = {
    "conv-001": 13,
    "conv-002": 11,
    "conv-003": 10,
    "conv-004": 12,
    "conv-005": 8,
    "conv-006": 9,
}


async def _advance_conversation(conv_id: str) -> None:
    conv = state.conversations.get(conv_id)
    if not conv:
        return
    if conv.finished or conv.control == "broker":
        return

    script = state.scripts.get(conv.script_id, [])
    if conv.script_step >= len(script):
        # Mark as finished
        if not conv.finished:
            finished_conv = conv.model_copy(update={"status": "resolved", "finished": True})
            state.conversations[conv_id] = finished_conv
            state.push_event("conversation_updated", finished_conv.model_dump(mode="json"))
        return

    next_message = script[conv.script_step]
    new_step = conv.script_step + 1
    updated_conv = conv.model_copy(update={"script_step": new_step})
    state.conversations[conv_id] = updated_conv

    try:
        await run_agent_pipeline(conv_id, next_message, is_handback=False)
    except Exception as e:
        logger.error(f"Pipeline error for {conv_id}: {e}", exc_info=True)

    # Check if this was the last message
    final_conv = state.conversations.get(conv_id)
    if final_conv and final_conv.script_step >= len(script):
        resolved = final_conv.model_copy(update={"status": "resolved", "finished": True})
        state.conversations[conv_id] = resolved
        state.push_event("conversation_updated", resolved.model_dump(mode="json"))


def start_scheduler() -> None:
    for conv_id, interval in CONV_INTERVALS.items():
        scheduler.add_job(
            _advance_conversation,
            trigger=IntervalTrigger(seconds=interval, jitter=2),
            args=[conv_id],
            id=f"ticker_{conv_id}",
            max_instances=1,
            replace_existing=True,
            coalesce=True,
        )
    scheduler.start()
    logger.info("Conversation scheduler started")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Conversation scheduler stopped")


def restart_scheduler() -> None:
    stop_scheduler()
    # Remove all jobs and re-add
    for job in scheduler.get_jobs():
        job.remove()
    start_scheduler()
