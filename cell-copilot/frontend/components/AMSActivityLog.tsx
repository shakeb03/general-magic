"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUIStore } from "@/stores/useUIStore";
import { OpportunitiesTab } from "./OpportunitiesTab";
import { EpicActivityModal } from "./EpicActivityModal";
import type { AMSActivity } from "@/lib/api";
import { cn } from "@/lib/utils";

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  activity_logged:     { icon: "📋", color: "text-warm-700",    bg: "bg-cream-100 border-cream-300",      label: "Note" },
  policy_updated:      { icon: "📄", color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",         label: "Policy" },
  quote_logged:        { icon: "💰", color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",       label: "Quote" },
  endorsement_drafted: { icon: "✏️", color: "text-purple-700",  bg: "bg-purple-50 border-purple-200",     label: "Endorsement" },
  claim_filed:         { icon: "🚨", color: "text-coral-700",   bg: "bg-coral-50 border-coral-200",       label: "Claim" },
  payment_updated:     { icon: "💳", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200",   label: "Payment" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function ActivityRow({ activity, onClick, isNew }: { activity: AMSActivity; onClick: () => void; isNew: boolean }) {
  const cfg = ACTION_CONFIG[activity.action_type] ?? ACTION_CONFIG.activity_logged;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-cream-200 transition-all duration-200 group hover:bg-cream-50",
        isNew && "bg-coral-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 w-7 h-7 rounded-md border flex items-center justify-center text-sm mt-0.5", cfg.bg)}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className={cn("text-[10px] font-bold uppercase tracking-wide", cfg.color)}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-cream-500 flex-shrink-0">{timeAgo(activity.timestamp)}</span>
          </div>
          <p className="text-xs text-warm-800 leading-snug line-clamp-2 group-hover:text-warm-900 transition-colors">
            {activity.description}
          </p>
        </div>
      </div>
    </button>
  );
}

export function AMSActivityLog() {
  const { amsActivities, opportunities, activeTab, setActiveTab } = useUIStore();
  const [selectedActivity, setSelectedActivity] = useState<AMSActivity | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceUpdate(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (amsActivities.length === 0) return;
    const latest = amsActivities[0];
    if (!newIds.has(latest.id)) {
      setNewIds(prev => { const n = new Set(prev); n.add(latest.id); return n; });
      setTimeout(() => setNewIds(prev => { const n = new Set(prev); n.delete(latest.id); return n; }), 3000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amsActivities]);

  return (
    <div className="flex flex-col h-full bg-cream-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-cream-200 flex-shrink-0 bg-cream-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-warm-700 uppercase tracking-widest">Applied Epic</h2>
            {amsActivities.length > 0 && (
              <span className="text-[10px] font-bold text-warm-700 bg-cream-200 border border-cream-300 px-1.5 py-0.5 rounded-md">
                {amsActivities.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[10px] text-warm-700">AMS sync</span>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={v => setActiveTab(v as "activity" | "opportunities")}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <TabsList className="flex-shrink-0 bg-transparent border-b border-cream-200 rounded-none h-9 px-3 gap-1">
          <TabsTrigger
            value="activity"
            className="text-[11px] h-7 px-3 data-[state=active]:bg-white data-[state=active]:text-warm-900 data-[state=active]:shadow-sm text-warm-700 rounded-md border border-transparent data-[state=active]:border-cream-300"
          >
            Activity
          </TabsTrigger>
          <TabsTrigger
            value="opportunities"
            className="text-[11px] h-7 px-3 data-[state=active]:bg-white data-[state=active]:text-warm-900 data-[state=active]:shadow-sm text-warm-700 rounded-md border border-transparent data-[state=active]:border-cream-300 relative"
          >
            Opportunities
            {opportunities.length > 0 && (
              <span className="ml-1.5 w-4 h-4 text-[9px] font-bold rounded-full bg-coral-500 text-white inline-flex items-center justify-center">
                {opportunities.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="flex-1 overflow-y-auto mt-0 scrollbar-thin">
          {amsActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-10 h-10 rounded-xl bg-cream-200 border border-cream-300 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 4h12M3 8h8M3 12h10" stroke="#C8C0B4" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-xs text-cream-500">No activities logged yet</p>
            </div>
          ) : (
            amsActivities.map(a => (
              <ActivityRow
                key={a.id}
                activity={a}
                onClick={() => setSelectedActivity(a)}
                isNew={newIds.has(a.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="opportunities" className="flex-1 overflow-y-auto mt-0 scrollbar-thin">
          <OpportunitiesTab />
        </TabsContent>
      </Tabs>

      <EpicActivityModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
    </div>
  );
}
