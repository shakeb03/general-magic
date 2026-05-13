"use client";

import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface Props { convId: string; }

const FLAG_CONFIG = {
  frustration: { icon: "😤", label: "Frustration Detected",
    high: "bg-coral-50 border-coral-300 text-coral-800",
    med:  "bg-amber-50 border-amber-300 text-amber-800" },
  risk:        { icon: "⚠️", label: "Risk Detected",
    high: "bg-coral-50 border-coral-300 text-coral-800",
    med:  "bg-orange-50 border-orange-300 text-orange-800" },
  complexity:  { icon: "🔀", label: "Complexity Flagged",
    high: "bg-orange-50 border-orange-300 text-orange-800",
    med:  "bg-amber-50 border-amber-300 text-amber-800" },
};

export function FlagBanner({ convId }: Props) {
  const { flags, dismissedFlagIds, dismissFlag, conversations } = useUIStore();
  const conv = conversations.find(c => c.id === convId);

  const active = flags.filter(
    f => f.conversation_id === convId &&
         !dismissedFlagIds.has(f.id) &&
         (f.severity === "high" || f.severity === "medium")
  );

  if (active.length === 0) return null;
  const flag = active[active.length - 1];
  const cfg = FLAG_CONFIG[flag.flag_type];
  const colorClass = flag.severity === "high" ? cfg.high : cfg.med;

  return (
    <div className={cn(
      "px-4 py-2.5 flex items-start gap-3 border-b animate-in slide-in-from-top duration-300",
      colorClass
    )}>
      <span className="text-base flex-shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold uppercase tracking-wide">{cfg.label}</span>
          <span className={cn(
            "text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full border",
            flag.severity === "high"
              ? "bg-coral-100 text-coral-700 border-coral-200"
              : "bg-amber-100 text-amber-700 border-amber-200"
          )}>
            {flag.severity}
          </span>
        </div>
        <p className="text-xs opacity-80 leading-relaxed">{flag.recommendation}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        {conv?.control === "agent" && (
          <button
            onClick={() => api.takeover(convId)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-md font-semibold transition-all",
              flag.severity === "high"
                ? "bg-coral-500 hover:bg-coral-600 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-white"
            )}
          >
            Take over
          </button>
        )}
        <button
          onClick={() => dismissFlag(flag.id)}
          className="text-current opacity-40 hover:opacity-70 transition-opacity text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
