const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  getConversations: () => apiFetch<Conversation[]>("/conversations"),

  getMessages: (convId: string) =>
    apiFetch<Message[]>(`/conversations/${convId}/messages`),

  getAMSActivities: () => apiFetch<AMSActivity[]>("/ams_activities"),

  getOpportunities: () => apiFetch<Opportunity[]>("/opportunities"),

  getFlags: () => apiFetch<Flag[]>("/flags"),

  takeover: (convId: string) =>
    apiFetch(`/conversations/${convId}/takeover`, { method: "POST" }),

  handback: (convId: string) =>
    apiFetch(`/conversations/${convId}/handback`, { method: "POST" }),

  sendMessage: (convId: string, content: string) =>
    apiFetch<Message>(`/conversations/${convId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),

  suggestReply: (convId: string) =>
    apiFetch<{ draft: string }>(`/conversations/${convId}/suggest`, {
      method: "POST",
    }),

  reset: () => apiFetch("/reset", { method: "POST" }),
};

// Shared types (mirrors backend Pydantic models)
export interface Conversation {
  id: string;
  customer_name: string;
  customer_phone: string;
  line_of_business: "auto" | "home" | "commercial" | "life" | "billing";
  status: "green" | "yellow" | "red" | "resolved";
  current_activity: string;
  control: "agent" | "broker";
  script_id: string;
  script_step: number;
  started_at: string;
  finished: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: "customer" | "agent" | "broker";
  content: string;
  timestamp: string;
  reasoning: string | null;
}

export interface Flag {
  id: string;
  conversation_id: string;
  message_id: string;
  flag_type: "frustration" | "risk" | "complexity";
  severity: "low" | "medium" | "high";
  recommendation: string;
  created_at: string;
}

export interface Opportunity {
  id: string;
  conversation_id: string;
  signal: string;
  opportunity_type: "cross_sell_home" | "cross_sell_life" | "cross_sell_auto" | "life_event";
  est_value: number;
  created_at: string;
}

export interface AMSActivity {
  id: string;
  conversation_id: string;
  action_type:
    | "activity_logged"
    | "policy_updated"
    | "quote_logged"
    | "endorsement_drafted"
    | "claim_filed"
    | "payment_updated";
  description: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
