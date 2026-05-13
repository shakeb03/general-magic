import asyncio
from datetime import datetime
from typing import Literal
from pydantic import BaseModel


class Conversation(BaseModel):
    id: str
    customer_name: str
    customer_phone: str
    line_of_business: Literal["auto", "home", "commercial", "life", "billing"]
    status: Literal["green", "yellow", "red", "resolved"]
    current_activity: str
    control: Literal["agent", "broker"]
    script_id: str
    script_step: int
    started_at: datetime
    finished: bool = False


class Message(BaseModel):
    id: str
    conversation_id: str
    sender: Literal["customer", "agent", "broker"]
    content: str
    timestamp: datetime
    reasoning: str | None = None


class Flag(BaseModel):
    id: str
    conversation_id: str
    message_id: str
    flag_type: Literal["frustration", "risk", "complexity"]
    severity: Literal["low", "medium", "high"]
    recommendation: str
    created_at: datetime


class Opportunity(BaseModel):
    id: str
    conversation_id: str
    signal: str
    opportunity_type: Literal["cross_sell_home", "cross_sell_life", "cross_sell_auto", "life_event"]
    est_value: int
    created_at: datetime


class AMSActivity(BaseModel):
    id: str
    conversation_id: str
    action_type: Literal[
        "activity_logged", "policy_updated", "quote_logged",
        "endorsement_drafted", "claim_filed", "payment_updated"
    ]
    description: str
    payload: dict
    timestamp: datetime


class Policy(BaseModel):
    id: str
    customer_name: str
    type: Literal["auto", "home", "commercial", "life", "billing"]
    carrier: str
    premium: int
    details: dict


# In-memory state
conversations: dict[str, Conversation] = {}
messages: dict[str, list[Message]] = {}
flags: dict[str, Flag] = {}
opportunities: dict[str, Opportunity] = {}
ams_activities: dict[str, AMSActivity] = {}
policies: dict[str, Policy] = {}
scripts: dict[str, list[str]] = {}

# SSE event queue — drained by the /stream endpoint
event_queue: asyncio.Queue = asyncio.Queue()

# Multiple SSE subscribers (one per open browser tab)
_subscribers: list[asyncio.Queue] = []


def push_event(event_type: str, data: dict) -> None:
    payload = {"type": event_type, "data": data}
    for q in _subscribers:
        q.put_nowait(payload)


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    try:
        _subscribers.remove(q)
    except ValueError:
        pass


def clear_all() -> None:
    conversations.clear()
    messages.clear()
    flags.clear()
    opportunities.clear()
    ams_activities.clear()
    policies.clear()
    scripts.clear()
