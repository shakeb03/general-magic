import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field

import anthropic

from app import state
from app.state import Flag, Opportunity
from app.agent.prompts import DETECTOR_PROMPTS

logger = logging.getLogger(__name__)


@dataclass
class DetectorResult:
    detected: bool = False
    severity: str = "low"
    signals: list[str] = field(default_factory=list)
    recommendation: str = ""
    signal: str = ""
    opportunity_type: str = "life_event"
    est_value: int = 0


@dataclass
class DetectorResults:
    frustration: DetectorResult = field(default_factory=DetectorResult)
    risk: DetectorResult = field(default_factory=DetectorResult)
    complexity: DetectorResult = field(default_factory=DetectorResult)
    cross_sell: DetectorResult = field(default_factory=DetectorResult)


async def _run_single_detector(
    client: anthropic.AsyncAnthropic,
    detector_type: str,
    conversation_history: list[dict],
    new_message: str,
) -> DetectorResult:
    messages = conversation_history + [{"role": "user", "content": new_message}]
    try:
        response = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=256,
            system=DETECTOR_PROMPTS[detector_type],
            messages=messages,
        )
        text = response.content[0].text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = json.loads(text)
        return DetectorResult(**{k: v for k, v in data.items() if k in DetectorResult.__dataclass_fields__})
    except Exception as e:
        logger.warning(f"Detector {detector_type} failed: {e}")
        return DetectorResult()


async def run_detectors(
    conv_id: str,
    conversation_history: list[dict],
    new_message: str,
    latest_message_id: str,
) -> DetectorResults:
    client = anthropic.AsyncAnthropic()

    frustration_task = _run_single_detector(client, "frustration", conversation_history, new_message)
    risk_task = _run_single_detector(client, "risk", conversation_history, new_message)
    complexity_task = _run_single_detector(client, "complexity", conversation_history, new_message)
    cross_sell_task = _run_single_detector(client, "cross_sell", conversation_history, new_message)

    frustration, risk, complexity, cross_sell = await asyncio.gather(
        frustration_task, risk_task, complexity_task, cross_sell_task
    )

    results = DetectorResults(
        frustration=frustration,
        risk=risk,
        complexity=complexity,
        cross_sell=cross_sell,
    )

    _process_flag(conv_id, latest_message_id, "frustration", frustration)
    _process_flag(conv_id, latest_message_id, "risk", risk)
    _process_flag(conv_id, latest_message_id, "complexity", complexity)
    _process_cross_sell(conv_id, cross_sell)

    return results


def _process_flag(conv_id: str, message_id: str, flag_type: str, result: DetectorResult) -> None:
    if not result.detected or result.severity == "low":
        return

    flag = Flag(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        message_id=message_id,
        flag_type=flag_type,
        severity=result.severity,
        recommendation=result.recommendation,
        created_at=datetime.now(timezone.utc),
    )
    state.flags[flag.id] = flag
    state.push_event("flag", flag.model_dump(mode="json"))

    # Update conversation status
    conv = state.conversations.get(conv_id)
    if conv:
        new_status = "red" if result.severity == "high" else "yellow"
        if conv.status not in ("red",):  # don't downgrade from red
            updated = conv.model_copy(update={"status": new_status})
            state.conversations[conv_id] = updated
            state.push_event("conversation_updated", updated.model_dump(mode="json"))


def _process_cross_sell(conv_id: str, result: DetectorResult) -> None:
    if not result.detected:
        return

    opportunity = Opportunity(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        signal=result.signal,
        opportunity_type=result.opportunity_type,
        est_value=result.est_value or 1800,
        created_at=datetime.now(timezone.utc),
    )
    state.opportunities[opportunity.id] = opportunity
    state.push_event("opportunity", opportunity.model_dump(mode="json"))


def build_detector_summary(results: DetectorResults) -> str:
    lines = []
    for dtype, result in [("frustration", results.frustration), ("risk", results.risk), ("complexity", results.complexity)]:
        if result.detected:
            lines.append(f"- {dtype.upper()} detected (severity: {result.severity}): {result.recommendation}")
    return "\n".join(lines) if lines else ""
