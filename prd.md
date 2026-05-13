# Cell Co-Pilot: PRD

A live broker workstation that watches AI agents handle simultaneous customer SMS conversations for an insurance brokerage. Built as a demo artifact for outreach to General Magic.

---

## 1. Goal

Build a single-screen web app where a broker can:

1. See six AI agents handling six different customer SMS conversations in parallel.
2. Watch each agent reason about tone, risk, complexity, and cross-sell opportunities in real time.
3. Take over any conversation with one click and hand it back when done.
4. See every agent action logged to a mocked Applied Epic activity feed.

The success bar is a 90-second Loom that makes a CTO say "this person already understands our product."

---

## 2. Final deliverable

- One URL hosted on Vercel.
- Backend on Railway (FastAPI, single service, no database).
- Six seeded conversations that begin auto-running the moment the page loads.
- Real Anthropic API calls for every agent response and every detector.
- A 90-second Loom recording walking through the six scenes in section 8.

---

## 3. Tech stack

**Frontend (Vercel)**
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Server-sent events for real-time updates from backend
- TanStack Query for any non-streaming fetches
- Zustand for client-side panel state

**Backend (Railway)**
- FastAPI (Python 3.11)
- In-memory state (plain Python dicts, no database)
- Pydantic models for shape validation
- JSON seed files for scripts and mock policies
- Anthropic Python SDK
- APScheduler for the conversation timing controller
- Server-sent events endpoint for live updates

**AI**
- Anthropic API: `claude-sonnet-4-5` for agent responses, `claude-haiku-4-5` for the four detectors (cheaper, faster, parallel)

**No CI/CD, no auth, no multi-tenancy.** One hardcoded brokerage, one hardcoded broker user, one URL.

---

## 4. Architecture

```
[Next.js on Vercel]
       |
       |  SSE for live updates
       |  REST for actions (takeover, send, handback)
       v
[FastAPI on Railway]
       |
       |  In-memory state (Python dicts)
       |  JSON seed files loaded at startup
       |
       |  Anthropic API calls
       v
[Claude Sonnet 4.5 + Claude Haiku 4.5]
```

The backend runs a scheduler that drives the demo. Every few seconds it advances one of the six scripted conversations by injecting the next scripted customer message. Each new customer message triggers the agent pipeline (detectors in parallel, then response generation). All state lives in memory as Python dicts. JSON seed files are loaded once at startup. Server restart = full reset, which is what you want between Loom takes. The frontend subscribes to an SSE stream and re-renders.

---

## 5. State shape

All state lives in a single `state.py` module on the backend as Python dicts keyed by id. Pydantic models define the shape. No database, no ORM, no migrations.

```python
# state.py
conversations: dict[str, Conversation] = {}
messages: dict[str, Message] = {}
flags: dict[str, Flag] = {}
opportunities: dict[str, Opportunity] = {}
ams_activities: dict[str, AMSActivity] = {}
policies: dict[str, Policy] = {}      # loaded from seed JSON, read-only
```

Pydantic models:

```python
class Conversation(BaseModel):
    id: str
    customer_name: str
    customer_phone: str
    line_of_business: Literal["auto", "home", "commercial", "life", "billing"]
    status: Literal["green", "yellow", "red", "resolved"]
    current_activity: str           # "Collecting VIN", "Comparing carriers"
    control: Literal["agent", "broker"]
    script_id: str                  # which scripted scenario
    script_step: int                # cursor into the script
    started_at: datetime

class Message(BaseModel):
    id: str
    conversation_id: str
    sender: Literal["customer", "agent", "broker"]
    content: str
    timestamp: datetime
    reasoning: str | None = None    # agent's one-line reasoning summary

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
    signal: str                     # "Customer mentioned home purchase"
    opportunity_type: Literal["cross_sell_home", "cross_sell_life", "cross_sell_auto", "life_event"]
    est_value: int                  # annual premium estimate
    created_at: datetime

class AMSActivity(BaseModel):
    id: str
    conversation_id: str
    action_type: Literal["activity_logged", "policy_updated", "quote_logged",
                         "endorsement_drafted", "claim_filed", "payment_updated"]
    description: str                # "Updated policy POL-4421: added Honda Civic VIN"
    payload: dict                   # structured data for the expand modal
    timestamp: datetime

class Policy(BaseModel):
    id: str                         # POL-4421
    customer_name: str
    type: Literal["auto", "home", "commercial", "life"]
    carrier: str
    premium: int
    details: dict
```

**Seed loading.** On startup, `seed.py` reads JSON files from `/backend/seed/` and populates `policies` plus the initial six conversations. Conversation scripts (the customer side of each thread) are kept in a separate `scripts: dict[str, list[str]]` that the scheduler reads from.

**Reset.** A single `POST /reset` endpoint clears all dicts and re-runs the seed loader. One function call.

**Concurrency.** FastAPI runs as a single worker for this demo. No locking needed.

---

## 6. The six seeded conversations

Each conversation has a hard-coded script for the customer side. The agent side is generated live by Claude. Scripts are JSON files in `/backend/scripts/`.

### Script 1: Quote intake (auto)
- New customer. Five customer messages collecting info.
- Agent collects driver age, vehicle, VIN, postal code.
- At message 5, agent calls mocked carrier rate engine (returns four hardcoded rates from Intact, Aviva, Wawanesa, Economical).
- AMS log: `quote_logged` with all four rates.
- Status: green throughout.

### Script 2: Renewal Q&A
- Existing customer (POL-4421, home insurance, $1,847 renewing in 47 days).
- Customer asks why premium went up 18%.
- Agent reads policy from the `policies` dict, generates an explanation grounded in the seeded loss-ratio data, offers three options (accept, shop alternatives, increase deductible).
- AMS log: `activity_logged` for the renewal discussion.

### Script 3: Endorsement request (home)
- Existing customer adding a finished basement.
- Three customer messages.
- Agent asks square footage, asks about plumbing/electrical, drafts endorsement showing $34/month premium impact.
- AMS log: `endorsement_drafted` with the structured endorsement object.

### Script 4: Claims FNOL (this is the live takeover demo)
- Existing customer reporting a fender-bender.
- Message 1: neutral. "I was in a small accident."
- Message 2: agent collects facts.
- Message 3: customer escalates. "Look, my car is undriveable and I have a meeting in an hour. Can you just help me?"
- **Frustration detector trips. Row turns yellow. Banner appears.**
- Demo path: broker clicks "Take over," sends an empathetic message, clicks "Hand back."
- Agent resumes, files the loss notice.
- AMS log: `claim_filed`.

### Script 5: Billing question (resolves end-to-end)
- Existing customer: "Why didn't my payment go through?"
- Agent checks mocked billing system (a function returning hardcoded "card expired 11/2025").
- Agent sends a secure link, customer confirms updated.
- AMS log: `payment_updated`.
- Status: green. Resolved in 4 messages, no broker touch.

### Script 6: Silent cross-sell
- Existing auto customer asking about a payment due date.
- In message 2, customer mentions "we just closed on the new house last week, things are hectic."
- Cross-sell detector fires silently. Card added to Opportunities tab.
- Agent answers the payment question normally without mentioning the home purchase.
- AMS log: standard payment question response.

**Timing controller:** The scheduler advances each conversation by one customer message every 8 to 14 seconds (jittered for naturalness). Conversations 5 and 6 finish first. Conversation 4 hits its escalation around the 60-second mark of the demo.

---

## 7. Feature specs

### 7.1 Left panel: conversation queue

A vertical scrollable list. Each row:
- Avatar circle with customer initials
- Customer name + line of business
- Current activity (one line, italic, gray)
- Status pill (green/yellow/red/resolved)
- Last message preview (truncated)
- Subtle pulse animation when a new message arrives

Click to load that conversation in the middle panel. Active row gets a left-border highlight.

Sort order: yellow/red on top, then green, then resolved at the bottom.

### 7.2 Middle panel: conversation view

**Header strip:** customer name, phone number, line of business tag, current activity in italic.

**Reasoning strip:** thin bar above messages. Shows the agent's current internal state. Examples:
- "Checking if customer's existing policy covers rental vehicles..."
- "Detected frustration. Tone-softening response and flagging for review."
- "Pulling rates from four carriers..."

This updates live during agent generation. When the agent is idle, it shows "Waiting for next customer message."

**Message thread:** iMessage-style bubbles. Customer left, agent/broker right. Broker messages have a subtle different tint to distinguish from agent messages. Timestamps every few messages.

**Flag banner:** when a flag fires, a banner slides down between the reasoning strip and the messages. Yellow for medium, red for high. Includes the flag type, severity, and recommendation. Has a "Take over" button inline.

**Input area:**
- Text input (disabled when agent is in control)
- Three buttons: **Take over**, **Suggest a reply**, **Hand back**
- "Take over" enables the text input and pauses the agent
- "Suggest a reply" calls the backend to generate a draft for the broker to edit
- "Hand back" sends a signal to the agent that it can resume, agent's next message acknowledges the handoff

### 7.3 Right panel: AMS activity log

**Tab 1: Activity log** (default)
- Reverse chronological feed
- Each entry: timestamp (relative, e.g., "2m ago"), customer name, action type icon, one-line description
- Click to expand a modal styled like Applied Epic's activity screen showing the full payload
- Pulse animation when a new entry lands

**Tab 2: Opportunities**
- Cards showing cross-sell opportunities flagged by the detector
- Each card: customer name, signal text ("Mentioned home purchase"), opportunity type, estimated annual premium value, "Schedule follow-up" button (no-op, just visual)

**Tab 3: Coverage** (stretch goal, skip if behind schedule)
- A simple grid showing which carriers each customer has policies with

---

## 8. The flagging system

For every customer message, the backend runs four detectors in parallel as separate Claude Haiku 4.5 calls. Each returns structured JSON.

**Frustration detector**
- Input: full conversation history + new message
- Output: `{ detected: bool, severity: low|medium|high, signals: [str], recommendation: str }`
- Severity high = banner + status red + sound

**Risk detector**
- Watches for: verbal binding language, unauthorized coverage promises, regulatory landmines (verbal quote commitments, claim admissions, etc.)
- Output: same shape as frustration

**Complexity detector**
- Watches for: multi-policy households, unusual exposures, potential fraud indicators, anything outside the agent's confidence zone
- Output: same shape

**Cross-sell detector (silent)**
- Watches for: life events (marriage, baby, home purchase, job change, retirement)
- Output: `{ detected: bool, signal: str, opportunity_type: str, est_value: int }`
- Never interrupts the conversation. Just creates an opportunity card.

The four detectors run as `asyncio.gather()`. Total latency target: under 1.2 seconds.

---

## 9. Anthropic API integration

### 9.1 Agent response generation

One Claude Sonnet 4.5 call per agent message. System prompt includes:
- The brokerage's voice/tone guidelines (one paragraph, hardcoded)
- The customer's policy data (read from the in-memory `policies` dict if existing customer)
- The conversation history
- The output of the four detectors for the latest customer message
- Available tools (function calling)

**Tools the agent can call:**
- `get_policy(policy_id)` - returns policy data from the `policies` dict
- `pull_carrier_rates(driver_info, vehicle_info)` - returns four hardcoded rates with small randomization
- `check_billing_status(customer_id)` - returns hardcoded billing state
- `draft_endorsement(policy_id, changes)` - appends to `ams_activities` dict
- `file_claim(policy_id, claim_details)` - appends to `ams_activities` dict
- `log_activity(conversation_id, description)` - appends a generic entry to `ams_activities`
- `update_payment_method(customer_id, new_method)` - appends to `ams_activities`

The agent decides which tools to call based on the conversation. Multi-turn tool use is fine.

The agent's reasoning summary (one sentence) is extracted and stored on the message so the middle panel can show it in the reasoning strip.

### 9.2 Broker suggest-a-reply

When broker clicks "Suggest a reply," call Claude Sonnet 4.5 with the conversation history and a system prompt asking for a draft reply the broker can edit. Return the text into the input field as editable content.

### 9.3 Handback acknowledgment

When broker hands back, the agent's next message starts with a context-aware acknowledgment of the broker's intervention before continuing the original task. This is achieved by including the broker messages and a system note ("Broker just handled the previous turn(s). Acknowledge briefly, then continue.") in the next agent prompt.

---

## 10. Build order (4-6 days)

### Day 1: Backend foundation + conversation engine
- FastAPI project deployed to Railway
- `state.py` with in-memory dicts and Pydantic models
- `seed.py` loading the six scripts + mock policies from JSON
- Scheduler that advances scripted conversations
- Agent response generation (Claude Sonnet 4.5 with tool calling)
- All seven tools implemented (reading/writing in-memory state)
- Test: run script 1 (auto quote) end-to-end, see messages and AMS activities populate in `state`

### Day 2: Detectors + flagging
- Four Haiku detectors running in parallel via `asyncio.gather()`
- Flag creation logic
- Opportunity creation logic
- Test with script 4 (FNOL escalation) and script 6 (silent cross-sell)
- SSE endpoint streaming all state changes

### Day 3: Frontend shell
- Next.js project deployed to Vercel
- Three-panel layout with Tailwind + shadcn/ui
- SSE connection to backend
- Render conversations, messages, AMS log from live data (no interaction yet)

### Day 4: Interactive panels
- Take over / Suggest a reply / Hand back buttons wired up
- Flag banners
- AMS log expand modals
- Opportunities tab
- Reasoning strip
- Polish animations (pulse on new message, slide for banners)

### Day 5: Demo polish + Loom prep
- Tune script timing so the demo arc lands in 90 seconds
- `POST /reset` endpoint to wipe state and reload seed (for re-recording the Loom)
- Visual polish: typography, spacing, the Applied Epic modal styling
- Record Loom

### Day 6 (buffer)
- Whatever broke. Final Loom take.

---

## 11. The Loom (90 seconds, six scenes)

| Time | Action |
|------|--------|
| 0:00 to 0:12 | Wide shot of the dashboard. Six threads moving. AMS log scrolling on the right. Voiceover: "This is what a broker would see if they logged in right now." |
| 0:12 to 0:30 | Click thread 5 (billing). Show end-to-end resolution. Highlight the AMS log entry. "The agent just updated the payment method in Applied Epic. Broker never touched this." |
| 0:30 to 0:50 | Switch to thread 4 (FNOL). Frustration banner is live. Click Take over, type one empathy line, Hand back. "The detector caught the tone shift. I jumped in for one message. Agent picked up the claim filing from there." |
| 0:50 to 1:05 | Click thread 1 (quote intake). Watch four carrier rates come back, agent recommends, drafts the bind message. "Four carriers compared in eight seconds. Broker just approves." |
| 1:05 to 1:20 | Open Opportunities tab. Show the cross-sell card from thread 6. "Customer mentioned a home purchase three minutes ago. Agent flagged it without interrupting. Broker calls Monday." |
| 1:20 to 1:30 | AMS log scrolled to top. "Twenty-three activities logged in the last ten minutes. Every conversation, every action, in the system of record." Hold. End. |

---

## 12. Out of scope (explicitly cut)

- Real Twilio / real SMS. All conversations are simulated by the scheduler.
- Real AMS integration. The Applied Epic modal is styled to look real but reads from in-memory state.
- Persistent storage of any kind. State lives in memory; server restart resets the demo.
- Authentication, user accounts, multi-tenancy.
- Mobile responsiveness. Desktop only.
- Settings, history, reports, analytics dashboards.
- Voice channel. Text only.
- Embeddings / RAG. Policy lookups are direct dict reads.
- Production-grade rate limiting, error handling, observability. This is a demo.

---

## 13. Success criteria

**Technical**
- Six conversations run automatically when the page loads
- Every agent message is a real Anthropic API call
- The four detectors run in parallel under 1.2 seconds per customer message
- Frustration detector trips on script 4 message 3 reliably
- Cross-sell detector fires on script 6 message 2 reliably
- Broker takeover and handback work without losing conversation context
- AMS log shows 20+ entries by the 90-second mark

**Demo**
- 90-second Loom recorded
- Shareable URL works on a fresh browser session
- Reset endpoint allows re-recording

**Outreach**
- Loom + URL sent to General Magic's CTO with a 4-line cold email
- Subject line tested for opens, not for cleverness

---

## 14. File structure

```
cell-copilot/
├── frontend/                    # deployed to Vercel
│   ├── app/
│   │   ├── page.tsx            # the only page
│   │   ├── layout.tsx
│   │   └── api/                # any client-side proxies if needed
│   ├── components/
│   │   ├── ConversationQueue.tsx
│   │   ├── ConversationView.tsx
│   │   ├── AMSActivityLog.tsx
│   │   ├── OpportunitiesTab.tsx
│   │   ├── FlagBanner.tsx
│   │   ├── ReasoningStrip.tsx
│   │   └── EpicActivityModal.tsx
│   ├── lib/
│   │   ├── sse.ts              # SSE client
│   │   └── api.ts              # REST client
│   ├── stores/
│   │   └── useUIStore.ts       # active conversation, tab, etc
│   └── package.json
│
├── backend/                     # deployed to Railway
│   ├── app/
│   │   ├── main.py
│   │   ├── state.py             # in-memory dicts + Pydantic models
│   │   ├── routes/
│   │   │   ├── conversations.py
│   │   │   ├── messages.py
│   │   │   ├── stream.py        # SSE endpoint
│   │   │   └── reset.py
│   │   ├── agent/
│   │   │   ├── pipeline.py      # detectors + response + tools
│   │   │   ├── detectors.py
│   │   │   ├── prompts.py
│   │   │   └── tools.py
│   │   ├── scheduler/
│   │   │   └── conversation_runner.py
│   │   └── seed/
│   │       ├── scripts/         # JSON conversation scripts (one per scenario)
│   │       ├── policies.json    # seed policy data
│   │       └── load.py
│   ├── requirements.txt
│   └── railway.json
│
└── README.md
```

---

## 15. The one-line summary

Cell Co-Pilot is a single-screen broker workstation where six AI agents handle six customer conversations in parallel, with real Claude reasoning, real flagging, real broker takeover, and a live AMS activity feed. Built in 4-6 days, no database, state in memory, shipped to one Vercel URL, sent to General Magic with a 90-second Loom.