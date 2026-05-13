"use client";

import { useUIStore } from "@/stores/useUIStore";

const OPP_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  cross_sell_home: { icon: "🏠", label: "Home Insurance",  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  cross_sell_life: { icon: "❤️", label: "Life Insurance",  color: "text-rose-700",    bg: "bg-rose-50 border-rose-200" },
  cross_sell_auto: { icon: "🚗", label: "Auto Insurance",  color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  life_event:      { icon: "🌟", label: "Life Event",      color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function OpportunitiesTab() {
  const { opportunities, conversations } = useUIStore();
  const getName = (id: string) => conversations.find(c => c.id === id)?.customer_name ?? id;

  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        <div className="w-10 h-10 rounded-xl bg-cream-200 border border-cream-300 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2l2.09 4.26L16 7.27l-3.5 3.41.83 4.82L9 13.27l-4.33 2.23.83-4.82L2 7.27l4.91-.71L9 2z" stroke="#C8C0B4" strokeWidth="1.3" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-xs text-cream-500">No cross-sell signals yet</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2.5">
      {opportunities.map(opp => {
        const cfg = OPP_CONFIG[opp.opportunity_type] ?? OPP_CONFIG.life_event;
        return (
          <div key={opp.id} className="rounded-xl border border-cream-300 bg-white p-3.5 hover:bg-cream-50 transition-colors shadow-sm">
            <div className="flex items-start justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-base ${cfg.bg}`}>
                  {cfg.icon}
                </div>
                <div>
                  <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-[11px] text-warm-700 mt-0.5">{getName(opp.conversation_id)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-warm-900">${opp.est_value.toLocaleString()}</p>
                <p className="text-[10px] text-cream-500">/year</p>
              </div>
            </div>

            <div className="rounded-lg bg-cream-100 border border-cream-200 px-3 py-2 mb-3">
              <p className="text-[11px] text-warm-700 italic leading-relaxed">
                &ldquo;{opp.signal}&rdquo;
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cream-500">{timeAgo(opp.created_at)}</span>
              <button className="text-[11px] font-medium text-coral-600 hover:text-coral-700 bg-coral-50 hover:bg-coral-100 border border-coral-200 px-2.5 py-1 rounded-lg transition-all">
                Schedule Follow-up
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
