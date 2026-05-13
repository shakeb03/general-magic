import type { Conversation, Message, Flag, Opportunity, AMSActivity } from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let eventSource: EventSource | null = null;

export type SSEHandlers = {
  onSnapshot: (data: {
    conversations: Conversation[];
    messages: Record<string, Message[]>;
    flags: Flag[];
    opportunities: Opportunity[];
    ams_activities: AMSActivity[];
  }) => void;
  onMessage: (msg: Message) => void;
  onConversationUpdated: (conv: Conversation) => void;
  onFlag: (flag: Flag) => void;
  onOpportunity: (opp: Opportunity) => void;
  onAMSActivity: (activity: AMSActivity) => void;
  onReset: () => void;
};

export function connectSSE(handlers: SSEHandlers): () => void {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource(`${API_BASE}/stream`);

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data);
      switch (event.type) {
        case "snapshot":
          handlers.onSnapshot(event.data);
          break;
        case "message":
          handlers.onMessage(event.data);
          break;
        case "conversation_updated":
          handlers.onConversationUpdated(event.data);
          break;
        case "flag":
          handlers.onFlag(event.data);
          break;
        case "opportunity":
          handlers.onOpportunity(event.data);
          break;
        case "ams_activity":
          handlers.onAMSActivity(event.data);
          break;
        case "reset":
          handlers.onReset();
          break;
      }
    } catch (err) {
      console.error("SSE parse error:", err);
    }
  };

  eventSource.onerror = () => {
    // Browser handles reconnection automatically
  };

  return () => {
    eventSource?.close();
    eventSource = null;
  };
}
