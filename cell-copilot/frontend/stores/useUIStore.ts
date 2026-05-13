import { create } from "zustand";
import type { Conversation, Message, Flag, Opportunity, AMSActivity } from "@/lib/api";

interface UIState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  flags: Flag[];
  opportunities: Opportunity[];
  amsActivities: AMSActivity[];

  activeConvId: string | null;
  activeTab: "activity" | "opportunities";
  dismissedFlagIds: Set<string>;

  setActiveConv: (id: string) => void;
  setActiveTab: (tab: "activity" | "opportunities") => void;
  dismissFlag: (flagId: string) => void;

  // SSE handlers
  handleSnapshot: (data: {
    conversations: Conversation[];
    messages: Record<string, Message[]>;
    flags: Flag[];
    opportunities: Opportunity[];
    ams_activities: AMSActivity[];
  }) => void;
  handleMessage: (msg: Message) => void;
  handleConvUpdated: (conv: Conversation) => void;
  handleFlag: (flag: Flag) => void;
  handleOpportunity: (opp: Opportunity) => void;
  handleAMSActivity: (activity: AMSActivity) => void;
  handleReset: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  conversations: [],
  messages: {},
  flags: [],
  opportunities: [],
  amsActivities: [],
  activeConvId: null,
  activeTab: "activity",
  dismissedFlagIds: new Set(),

  setActiveConv: (id) => set({ activeConvId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  dismissFlag: (flagId) =>
    set((state) => {
      const next = new Set(state.dismissedFlagIds);
      next.add(flagId);
      return { dismissedFlagIds: next };
    }),

  handleSnapshot: (data) =>
    set({
      conversations: data.conversations,
      messages: data.messages,
      flags: data.flags,
      opportunities: data.opportunities,
      amsActivities: data.ams_activities,
    }),

  handleMessage: (msg) =>
    set((state) => {
      const existing = state.messages[msg.conversation_id] ?? [];
      // Avoid duplicates
      if (existing.some((m) => m.id === msg.id)) return state;
      return {
        messages: {
          ...state.messages,
          [msg.conversation_id]: [...existing, msg],
        },
      };
    }),

  handleConvUpdated: (conv) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conv.id ? conv : c
      ),
    })),

  handleFlag: (flag) =>
    set((state) => {
      if (state.flags.some((f) => f.id === flag.id)) return state;
      return { flags: [...state.flags, flag] };
    }),

  handleOpportunity: (opp) =>
    set((state) => {
      if (state.opportunities.some((o) => o.id === opp.id)) return state;
      return { opportunities: [opp, ...state.opportunities] };
    }),

  handleAMSActivity: (activity) =>
    set((state) => {
      if (state.amsActivities.some((a) => a.id === activity.id)) return state;
      return { amsActivities: [activity, ...state.amsActivities] };
    }),

  handleReset: () =>
    set({
      conversations: [],
      messages: {},
      flags: [],
      opportunities: [],
      amsActivities: [],
      activeConvId: null,
      dismissedFlagIds: new Set(),
    }),
}));
