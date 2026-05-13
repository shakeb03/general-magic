import json
import logging
import uuid
from datetime import datetime, timezone

import anthropic

from app import state
from app.state import Message, Conversation
from app.agent.prompts import build_agent_system_prompt, build_suggest_prompt
from app.agent.tools import TOOL_DEFINITIONS, execute_tool
from app.agent.detectors import run_detectors, build_detector_summary

logger = logging.getLogger(__name__)

ACTIVITY_BY_TOOL = {
    "get_policy": "Reviewing policy details",
    "pull_carrier_rates": "Comparing carrier rates",
    "check_billing_status": "Checking billing status",
    "draft_endorsement": "Drafting endorsement",
    "file_claim": "Filing claim notice",
    "log_activity": "Logging activity",
    "update_payment_method": "Updating payment method",
}


def _build_history(conv_id: str) -> list[dict]:
    msgs = state.messages.get(conv_id, [])
    history = []
    for m in msgs:
        role = "user" if m.sender == "customer" else "assistant"
        content = m.content
        if m.reasoning and m.sender == "agent":
            content = f"reasoning: {m.reasoning}\n\n{m.content}"
        history.append({"role": role, "content": content})
    return history


async def run_agent_pipeline(conv_id: str, customer_message: str, is_handback: bool = False) -> None:
    conv = state.conversations.get(conv_id)
    if not conv:
        return

    # 1. Store customer message
    customer_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        sender="customer",
        content=customer_message,
        timestamp=datetime.now(timezone.utc),
    )
    state.messages[conv_id].append(customer_msg)
    state.push_event("message", customer_msg.model_dump(mode="json"))

    # 2. Run detectors in parallel
    history_for_detectors = _build_history(conv_id)[:-1]  # exclude the message we just added
    detector_results = await run_detectors(
        conv_id, history_for_detectors, customer_message, customer_msg.id
    )
    detector_summary = build_detector_summary(detector_results)

    # 3. Build system prompt
    policy = None
    # Try to find policy by matching customer name
    conv = state.conversations.get(conv_id)  # re-fetch after detector may have updated status
    for p in state.policies.values():
        if p.customer_name == conv.customer_name:
            policy = p
            break

    system_prompt = build_agent_system_prompt(conv, policy, detector_summary, is_handback)

    # 4. Call Claude Sonnet with tool use loop
    client = anthropic.AsyncAnthropic()
    messages = _build_history(conv_id)
    last_tool_used = None
    max_turns = 6

    for _ in range(max_turns):
        try:
            response = await client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=1024,
                system=system_prompt,
                tools=TOOL_DEFINITIONS,
                messages=messages,
            )
        except Exception as e:
            logger.error(f"Claude API error for {conv_id}: {e}")
            return

        # Handle tool use
        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    last_tool_used = block.name
                    result = execute_tool(block.name, block.input, conv_id)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })
                    # Update current activity
                    activity = ACTIVITY_BY_TOOL.get(block.name, conv.current_activity)
                    updated_conv = state.conversations[conv_id].model_copy(update={"current_activity": activity})
                    state.conversations[conv_id] = updated_conv
                    state.push_event("conversation_updated", updated_conv.model_dump(mode="json"))

            messages = messages + [
                {"role": "assistant", "content": response.content},
                {"role": "user", "content": tool_results},
            ]
            continue

        # Final text response
        text_content = ""
        for block in response.content:
            if hasattr(block, "text"):
                text_content = block.text.strip()
                break

        # Extract reasoning prefix
        reasoning = None
        reply_text = text_content
        if text_content.startswith("reasoning:"):
            lines = text_content.split("\n", 1)
            reasoning = lines[0].replace("reasoning:", "").strip()
            reply_text = lines[1].strip() if len(lines) > 1 else text_content

        # 5. Store agent message
        agent_msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv_id,
            sender="agent",
            content=reply_text,
            timestamp=datetime.now(timezone.utc),
            reasoning=reasoning,
        )
        state.messages[conv_id].append(agent_msg)
        state.push_event("message", agent_msg.model_dump(mode="json"))

        # Update current activity after response
        final_activity = conv.current_activity
        if last_tool_used:
            final_activity = ACTIVITY_BY_TOOL.get(last_tool_used, final_activity)
        else:
            final_activity = "Responding to customer"

        final_conv = state.conversations[conv_id].model_copy(update={"current_activity": final_activity})
        state.conversations[conv_id] = final_conv
        state.push_event("conversation_updated", final_conv.model_dump(mode="json"))
        return

    logger.warning(f"Tool use loop exceeded max turns for {conv_id}")


async def generate_suggest_reply(conv_id: str) -> str:
    conv = state.conversations.get(conv_id)
    if not conv:
        return ""

    policy = None
    for p in state.policies.values():
        if p.customer_name == conv.customer_name:
            policy = p
            break

    system_prompt = build_suggest_prompt(conv, policy)
    messages = _build_history(conv_id)

    client = anthropic.AsyncAnthropic()
    try:
        response = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=256,
            system=system_prompt,
            messages=messages,
        )
        return response.content[0].text.strip()
    except Exception as e:
        logger.error(f"Suggest reply error for {conv_id}: {e}")
        return ""
