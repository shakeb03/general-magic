"use client";

import { useUIStore } from "@/stores/useUIStore";

interface Props { convId: string; }

export function ReasoningStrip({ convId }: Props) {
  const { messages } = useUIStore();
  const convMessages = messages[convId] ?? [];
  const lastAgent = [...convMessages].reverse().find(m => m.sender === "agent");
  const reasoning = lastAgent?.reasoning ?? null;
  const isRecent = lastAgent && Date.now() - new Date(lastAgent.timestamp).getTime() < 8000;

  if (!reasoning && !isRecent) return null;

  return (
    <div className="px-5 py-2 border-b border-cream-200 bg-cream-50 flex items-start gap-2.5">
      <div className="flex items-center gap-1 mt-0.5 flex-shrink-0">
        {isRecent && !reasoning ? (
          <div className="flex gap-0.5 items-center">
            <span className="w-1 h-1 rounded-full bg-warm-700 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 rounded-full bg-warm-700 animate-bounce" style={{ animationDelay: "100ms" }} />
            <span className="w-1 h-1 rounded-full bg-warm-700 animate-bounce" style={{ animationDelay: "200ms" }} />
          </div>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="#9B9289" strokeWidth="1.2"/>
            <path d="M6 3.5v3l1.5 1" stroke="#9B9289" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-semibold text-warm-700 uppercase tracking-widest mr-2">
          {isRecent && !reasoning ? "Thinking" : "Reasoning"}
        </span>
        {reasoning && (
          <span className="text-xs text-warm-700 italic leading-relaxed">{reasoning}</span>
        )}
      </div>
    </div>
  );
}
