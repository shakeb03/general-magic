"use client";

import { useUIStore } from "@/stores/useUIStore";
import type { Conversation } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_ORDER = { red: 0, yellow: 1, green: 2, resolved: 3 };

const LOB_CONFIG: Record<string, { label: string; color: string }> = {
  auto:       { label: "Auto",    color: "text-blue-700 bg-blue-50 border-blue-200" },
  home:       { label: "Home",    color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  commercial: { label: "Comm.",   color: "text-orange-700 bg-orange-50 border-orange-200" },
  life:       { label: "Life",    color: "text-purple-700 bg-purple-50 border-purple-200" },
  billing:    { label: "Billing", color: "text-warm-700 bg-cream-200 border-cream-300" },
};

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

function UrgencyDot({ status }: { status: string }) {
  if (status === "red")      return <span className="inline-block w-2 h-2 rounded-full bg-coral-500 flex-shrink-0" />;
  if (status === "yellow")   return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />;
  if (status === "resolved") return <span className="inline-block w-2 h-2 rounded-full bg-cream-400 flex-shrink-0" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />;
}

function ConvRow({ conv, isActive, onClick }: { conv: Conversation; isActive: boolean; onClick: () => void }) {
  const { messages } = useUIStore();
  const convMessages = messages[conv.id] ?? [];
  const lastMsg = convMessages[convMessages.length - 1];
  const isNew = lastMsg && Date.now() - new Date(lastMsg.timestamp).getTime() < 6000;
  const lob = LOB_CONFIG[conv.line_of_business];
  const isResolved = conv.status === "resolved";
  const isUrgent = conv.status === "red";
  const isFlagged = conv.status === "yellow";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-cream-200 transition-all duration-150 group relative",
        isActive ? "bg-coral-50 border-l-2 border-l-coral-500" : "hover:bg-cream-50 border-l-2 border-l-transparent",
        isUrgent && !isActive && "row-urgent",
        isFlagged && !isActive && "row-flagged",
        isResolved && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0 mt-0.5">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
            avatarColor(conv.customer_name)
          )}>
            {initials(conv.customer_name)}
          </div>
          {isNew && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-coral-500 ring-2 ring-cream-100 animate-ping" />
          )}
          {isResolved && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-cream-300 ring-1 ring-cream-200 flex items-center justify-center">
              <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4l2 2 3-3" stroke="#9B9289" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-sm font-semibold text-warm-900 truncate">{conv.customer_name}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {conv.control === "broker" && (
                <span className="text-[10px] font-semibold text-coral-600 bg-coral-50 border border-coral-200 px-1.5 py-0.5 rounded-full">You</span>
              )}
              <UrgencyDot status={conv.status} />
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={cn("text-[10px] font-medium border px-1.5 py-0.5 rounded-full", lob.color)}>
              {lob.label}
            </span>
            <span className="text-[10px] text-warm-700 italic truncate">{conv.current_activity}</span>
          </div>

          {lastMsg ? (
            <div className="flex items-end justify-between gap-1">
              <p className="text-xs text-warm-700 truncate flex-1">
                <span className={cn(
                  "font-medium mr-0.5",
                  lastMsg.sender === "customer" ? "text-warm-700" :
                  lastMsg.sender === "broker"   ? "text-coral-600" : "text-warm-800"
                )}>
                  {lastMsg.sender === "customer" ? "" : lastMsg.sender === "broker" ? "You: " : "AI: "}
                </span>
                {lastMsg.content.slice(0, 55)}{lastMsg.content.length > 55 ? "…" : ""}
              </p>
              <span className="text-[10px] text-cream-500 flex-shrink-0">{timeAgo(lastMsg.timestamp)}</span>
            </div>
          ) : (
            <p className="text-xs text-cream-500 italic">Waiting to start…</p>
          )}
        </div>
      </div>
    </button>
  );
}

export function ConversationQueue() {
  const { conversations, activeConvId, setActiveConv } = useUIStore();
  const sorted = [...conversations].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const activeCount = conversations.filter(c => c.status !== "resolved").length;

  return (
    <div className="flex flex-col h-full border-r border-cream-300 overflow-hidden bg-cream-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-cream-200 flex-shrink-0 bg-cream-50">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-warm-700 uppercase tracking-widest">Threads</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[11px] text-warm-700 font-medium">{activeCount} active</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="#C8C0B4" strokeWidth="1.5"/>
                <path d="M7 4v3.5l2 1.5" stroke="#C8C0B4" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-xs text-cream-500">Connecting…</p>
          </div>
        )}
        {sorted.map(conv => (
          <ConvRow
            key={conv.id}
            conv={conv}
            isActive={conv.id === activeConvId}
            onClick={() => setActiveConv(conv.id)}
          />
        ))}
      </div>
    </div>
  );
}
