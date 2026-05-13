import random
import uuid
from datetime import datetime, timezone

from app import state
from app.state import AMSActivity

# Tool definitions for Claude function calling
TOOL_DEFINITIONS = [
    {
        "name": "get_policy",
        "description": "Retrieve a customer's policy details by policy ID.",
        "input_schema": {
            "type": "object",
            "properties": {
                "policy_id": {"type": "string", "description": "The policy ID, e.g. POL-4421"}
            },
            "required": ["policy_id"]
        }
    },
    {
        "name": "pull_carrier_rates",
        "description": "Pull auto insurance rates from four carriers for a given driver and vehicle. Returns four quotes.",
        "input_schema": {
            "type": "object",
            "properties": {
                "driver_info": {
                    "type": "object",
                    "description": "Driver details: age, licence_class, years_experience, tickets, accidents",
                    "properties": {
                        "age": {"type": "integer"},
                        "licence_class": {"type": "string"},
                        "years_clean": {"type": "integer"}
                    }
                },
                "vehicle_info": {
                    "type": "object",
                    "description": "Vehicle details: year, make, model, vin, postal_code, coverage_type",
                    "properties": {
                        "year": {"type": "integer"},
                        "make": {"type": "string"},
                        "model": {"type": "string"},
                        "vin": {"type": "string"},
                        "postal_code": {"type": "string"},
                        "coverage_type": {"type": "string"}
                    }
                }
            },
            "required": ["driver_info", "vehicle_info"]
        }
    },
    {
        "name": "check_billing_status",
        "description": "Check a customer's billing status and payment method details.",
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_id": {"type": "string", "description": "Policy ID or customer identifier"}
            },
            "required": ["customer_id"]
        }
    },
    {
        "name": "draft_endorsement",
        "description": "Draft a policy endorsement for a change in coverage or property details. Logs to AMS.",
        "input_schema": {
            "type": "object",
            "properties": {
                "policy_id": {"type": "string"},
                "changes": {
                    "type": "object",
                    "description": "Description of the endorsement changes",
                    "properties": {
                        "description": {"type": "string"},
                        "premium_impact_monthly": {"type": "number"},
                        "effective_date": {"type": "string"}
                    }
                }
            },
            "required": ["policy_id", "changes"]
        }
    },
    {
        "name": "file_claim",
        "description": "File a First Notice of Loss (FNOL) claim. Logs to AMS.",
        "input_schema": {
            "type": "object",
            "properties": {
                "policy_id": {"type": "string"},
                "claim_details": {
                    "type": "object",
                    "properties": {
                        "incident_type": {"type": "string"},
                        "incident_date": {"type": "string"},
                        "description": {"type": "string"},
                        "rental_needed": {"type": "boolean"}
                    }
                }
            },
            "required": ["policy_id", "claim_details"]
        }
    },
    {
        "name": "log_activity",
        "description": "Log a general activity note to the AMS for this conversation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "conversation_id": {"type": "string"},
                "description": {"type": "string", "description": "One-line description of the activity"}
            },
            "required": ["conversation_id", "description"]
        }
    },
    {
        "name": "update_payment_method",
        "description": "Record that a customer has updated their payment method. Logs to AMS.",
        "input_schema": {
            "type": "object",
            "properties": {
                "customer_id": {"type": "string"},
                "new_method": {"type": "string", "description": "Description of new payment method"}
            },
            "required": ["customer_id", "new_method"]
        }
    }
]


def _log_ams(conv_id: str, action_type: str, description: str, payload: dict) -> AMSActivity:
    activity = AMSActivity(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        action_type=action_type,
        description=description,
        payload=payload,
        timestamp=datetime.now(timezone.utc),
    )
    state.ams_activities[activity.id] = activity
    state.push_event("ams_activity", activity.model_dump(mode="json"))
    return activity


def execute_tool(tool_name: str, tool_input: dict, conv_id: str) -> str:
    if tool_name == "get_policy":
        return _get_policy(tool_input["policy_id"])
    elif tool_name == "pull_carrier_rates":
        return _pull_carrier_rates(tool_input["driver_info"], tool_input["vehicle_info"], conv_id)
    elif tool_name == "check_billing_status":
        return _check_billing_status(tool_input["customer_id"], conv_id)
    elif tool_name == "draft_endorsement":
        return _draft_endorsement(tool_input["policy_id"], tool_input["changes"], conv_id)
    elif tool_name == "file_claim":
        return _file_claim(tool_input["policy_id"], tool_input["claim_details"], conv_id)
    elif tool_name == "log_activity":
        return _log_activity(conv_id, tool_input["description"])
    elif tool_name == "update_payment_method":
        return _update_payment_method(tool_input["customer_id"], tool_input["new_method"], conv_id)
    else:
        return f"Unknown tool: {tool_name}"


def _get_policy(policy_id: str) -> str:
    policy = state.policies.get(policy_id)
    if not policy:
        return f"Policy {policy_id} not found."
    return policy.model_dump_json()


def _pull_carrier_rates(driver_info: dict, vehicle_info: dict, conv_id: str) -> str:
    base_rates = {
        "Intact": 1389,
        "Aviva": 1412,
        "Wawanesa": 1356,
        "Economical": 1298,
    }
    rates = []
    for carrier, base in base_rates.items():
        jitter = random.randint(-60, 60)
        annual = base + jitter
        rates.append({
            "carrier": carrier,
            "annual_premium": annual,
            "monthly_premium": round(annual / 12, 2),
            "coverage": vehicle_info.get("coverage_type", "Comprehensive + Collision"),
            "deductible": 500,
        })
    rates.sort(key=lambda r: r["annual_premium"])

    _log_ams(
        conv_id,
        "quote_logged",
        f"Pulled rates from 4 carriers. Lowest: {rates[0]['carrier']} at ${rates[0]['annual_premium']}/yr",
        {"rates": rates, "driver_info": driver_info, "vehicle_info": vehicle_info}
    )

    import json
    return json.dumps({"rates": rates})


def _check_billing_status(customer_id: str, conv_id: str) -> str:
    policy = state.policies.get(customer_id)
    if policy and "billing" in policy.details:
        billing = policy.details["billing"]
        return (
            f"Billing status: {billing.get('status', 'ACTIVE')}. "
            f"Card: {billing.get('payment_method', 'on file')}. "
            f"Expiry: {billing.get('card_expiry', 'N/A')}. "
            f"Next due: {billing.get('next_due', 'N/A')}, amount: ${billing.get('amount_due', 0):.2f}"
        )
    return "Billing status: ACTIVE. No issues found."


def _draft_endorsement(policy_id: str, changes: dict, conv_id: str) -> str:
    description = changes.get("description", "Policy endorsement")
    premium_impact = changes.get("premium_impact_monthly", 34)
    effective_date = changes.get("effective_date", "2026-06-01")

    _log_ams(
        conv_id,
        "endorsement_drafted",
        f"Endorsement drafted for {policy_id}: {description} (+${premium_impact}/mo)",
        {
            "policy_id": policy_id,
            "changes": changes,
            "premium_impact_monthly": premium_impact,
            "effective_date": effective_date,
            "status": "PENDING_APPROVAL"
        }
    )
    return f"Endorsement drafted for {policy_id}. Premium impact: +${premium_impact}/month. Effective: {effective_date}. Status: pending broker approval."


def _file_claim(policy_id: str, claim_details: dict, conv_id: str) -> str:
    claim_number = f"CLM-{random.randint(10000, 99999)}"
    _log_ams(
        conv_id,
        "claim_filed",
        f"FNOL filed for {policy_id}: {claim_details.get('incident_type', 'Auto accident')} — Claim #{claim_number}",
        {
            "policy_id": policy_id,
            "claim_number": claim_number,
            "claim_details": claim_details,
            "status": "FNOL_SUBMITTED",
            "adjuster_assigned": "TBD"
        }
    )
    return f"Claim {claim_number} filed for policy {policy_id}. An adjuster will be in touch within 1 business day. Rental coverage: {'confirmed' if claim_details.get('rental_needed') else 'not requested'}."


def _log_activity(conversation_id: str, description: str) -> str:
    _log_ams(
        conversation_id,
        "activity_logged",
        description,
        {"note": description}
    )
    return f"Activity logged: {description}"


def _update_payment_method(customer_id: str, new_method: str, conv_id: str) -> str:
    _log_ams(
        conv_id,
        "payment_updated",
        f"Payment method updated for {customer_id}: {new_method}",
        {"customer_id": customer_id, "new_method": new_method, "status": "UPDATED"}
    )
    return f"Payment method updated successfully for {customer_id}. New method: {new_method}."
