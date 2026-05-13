import json
import os
from datetime import datetime, timezone

from app import state
from app.state import Conversation, Policy

SEED_DIR = os.path.dirname(__file__)
SCRIPTS_DIR = os.path.join(SEED_DIR, "scripts")


def load_seed() -> None:
    state.clear_all()
    _load_policies()
    _load_scripts()


def _load_policies() -> None:
    path = os.path.join(SEED_DIR, "policies.json")
    with open(path) as f:
        data = json.load(f)
    for item in data:
        policy = Policy(**item)
        state.policies[policy.id] = policy


def _load_scripts() -> None:
    now = datetime.now(timezone.utc)
    for filename in sorted(os.listdir(SCRIPTS_DIR)):
        if not filename.endswith(".json"):
            continue
        path = os.path.join(SCRIPTS_DIR, filename)
        with open(path) as f:
            data = json.load(f)

        conv_id = data["conversation_id"]
        state.scripts[data["script_id"]] = data["messages"]
        state.messages[conv_id] = []

        conv = Conversation(
            id=conv_id,
            customer_name=data["customer_name"],
            customer_phone=data["customer_phone"],
            line_of_business=data["line_of_business"],
            status="green",
            current_activity=data["initial_activity"],
            control="agent",
            script_id=data["script_id"],
            script_step=0,
            started_at=now,
            finished=False,
        )
        state.conversations[conv_id] = conv
