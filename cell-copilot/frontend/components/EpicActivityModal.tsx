"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AMSActivity } from "@/lib/api";
import { cn } from "@/lib/utils";

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  activity_logged:     { icon: "📋", color: "text-warm-700",    bg: "bg-cream-100 border-cream-300",    label: "Activity Note" },
  policy_updated:      { icon: "📄", color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",       label: "Policy Updated" },
  quote_logged:        { icon: "💰", color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     label: "Quote Logged" },
  endorsement_drafted: { icon: "✏️", color: "text-purple-700",  bg: "bg-purple-50 border-purple-200",   label: "Endorsement Drafted" },
  claim_filed:         { icon: "🚨", color: "text-coral-700",   bg: "bg-coral-50 border-coral-200",     label: "Claim Filed" },
  payment_updated:     { icon: "💳", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", label: "Payment Updated" },
};

interface Props {
  activity: AMSActivity | null;
  onClose: () => void;
}

// ── Payload renderers ────────────────────────────────────────────────────────

function KVRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2 border-b border-cream-200 last:border-0", highlight && "bg-amber-50 -mx-3 px-3 rounded")}>
      <span className="text-xs text-warm-700 font-medium flex-shrink-0 w-36">{label}</span>
      <span className="text-xs text-warm-900 text-right font-medium">{value}</span>
    </div>
  );
}

function QuotePayload({ payload }: { payload: Record<string, unknown> }) {
  const rates = payload.rates as Array<{
    carrier: string;
    annual_premium: number;
    monthly_premium: number;
    coverage: string;
    deductible: number;
  }>;

  if (!rates?.length) return <FallbackPayload payload={payload} />;

  const lowest = rates[0];

  return (
    <div className="space-y-3">
      {/* Rate comparison table */}
      <div className="rounded-xl border border-cream-300 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-cream-100 border-b border-cream-300">
              <th className="text-left px-3 py-2 text-warm-700 font-semibold">Carrier</th>
              <th className="text-right px-3 py-2 text-warm-700 font-semibold">Annual</th>
              <th className="text-right px-3 py-2 text-warm-700 font-semibold">Monthly</th>
              <th className="text-right px-3 py-2 text-warm-700 font-semibold">Deductible</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r, i) => (
              <tr
                key={r.carrier}
                className={cn(
                  "border-b border-cream-200 last:border-0 transition-colors",
                  i === 0 ? "bg-emerald-50" : "bg-white hover:bg-cream-50"
                )}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {i === 0 && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                        Best
                      </span>
                    )}
                    <span className={cn("font-semibold", i === 0 ? "text-emerald-800" : "text-warm-900")}>
                      {r.carrier}
                    </span>
                  </div>
                </td>
                <td className={cn("px-3 py-2.5 text-right font-bold tabular-nums", i === 0 ? "text-emerald-700" : "text-warm-900")}>
                  ${r.annual_premium.toLocaleString()}
                </td>
                <td className="px-3 py-2.5 text-right text-warm-700 tabular-nums">
                  ${r.monthly_premium}/mo
                </td>
                <td className="px-3 py-2.5 text-right text-warm-700">
                  ${r.deductible}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Savings callout */}
      {rates.length > 1 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-emerald-700">Potential savings vs. highest quote</span>
          <span className="text-xs font-bold text-emerald-700">
            ${(rates[rates.length - 1].annual_premium - lowest.annual_premium).toLocaleString()}/yr
          </span>
        </div>
      )}

      {/* Coverage */}
      <div className="text-xs text-warm-700">
        <span className="font-medium">Coverage: </span>{lowest.coverage}
      </div>
    </div>
  );
}

function ClaimPayload({ payload }: { payload: Record<string, unknown> }) {
  const details = payload.claim_details as Record<string, unknown> ?? {};
  return (
    <div className="space-y-1">
      <KVRow label="Claim Number" value={
        <span className="font-mono text-coral-700 bg-coral-50 border border-coral-200 px-2 py-0.5 rounded text-[11px]">
          {payload.claim_number as string}
        </span>
      } highlight />
      <KVRow label="Policy" value={payload.policy_id as string} />
      <KVRow label="Status" value={
        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
          {(payload.status as string)?.replace(/_/g, " ")}
        </span>
      } />
      <KVRow label="Incident Type" value={details.incident_type as string ?? "—"} />
      <KVRow label="Incident Date" value={details.incident_date as string ?? "—"} />
      <KVRow label="Adjuster" value={payload.adjuster_assigned as string ?? "TBD"} />
      {details.rental_needed && (
        <KVRow label="Rental" value={
          <span className="text-emerald-700 font-medium">Requested</span>
        } />
      )}
      {details.description && (
        <div className="mt-2 pt-2 border-t border-cream-200">
          <p className="text-[10px] text-warm-700 font-medium uppercase tracking-widest mb-1">Description</p>
          <p className="text-xs text-warm-800 leading-relaxed">{details.description as string}</p>
        </div>
      )}
    </div>
  );
}

function EndorsementPayload({ payload }: { payload: Record<string, unknown> }) {
  const changes = payload.changes as Record<string, unknown> ?? {};
  return (
    <div className="space-y-1">
      <KVRow label="Policy" value={payload.policy_id as string} />
      <KVRow label="Status" value={
        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
          {(payload.status as string)?.replace(/_/g, " ")}
        </span>
      } highlight />
      <KVRow label="Effective Date" value={payload.effective_date as string ?? changes.effective_date as string ?? "—"} />
      <KVRow label="Premium Impact" value={
        <span className="font-bold text-coral-600">
          +${payload.premium_impact_monthly as number ?? changes.premium_impact_monthly as number ?? 0}/mo
        </span>
      } />
      {changes.description && (
        <div className="mt-2 pt-2 border-t border-cream-200">
          <p className="text-[10px] text-warm-700 font-medium uppercase tracking-widest mb-1">Changes</p>
          <p className="text-xs text-warm-800 leading-relaxed">{changes.description as string}</p>
        </div>
      )}
    </div>
  );
}

function PaymentPayload({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      <KVRow label="Customer" value={payload.customer_id as string} />
      <KVRow label="New Method" value={payload.new_method as string} />
      <KVRow label="Status" value={
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
          {payload.status as string}
        </span>
      } highlight />
    </div>
  );
}

function NotePayload({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="bg-cream-50 border border-cream-200 rounded-lg px-4 py-3">
      <p className="text-sm text-warm-800 leading-relaxed">{payload.note as string}</p>
    </div>
  );
}

function FallbackPayload({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="space-y-1">
      {Object.entries(payload).map(([k, v]) => (
        <KVRow
          key={k}
          label={k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
          value={typeof v === "object" ? JSON.stringify(v) : String(v)}
        />
      ))}
    </div>
  );
}

function PayloadRenderer({ actionType, payload }: { actionType: string; payload: Record<string, unknown> }) {
  switch (actionType) {
    case "quote_logged":        return <QuotePayload payload={payload} />;
    case "claim_filed":         return <ClaimPayload payload={payload} />;
    case "endorsement_drafted": return <EndorsementPayload payload={payload} />;
    case "payment_updated":     return <PaymentPayload payload={payload} />;
    case "activity_logged":
    case "policy_updated":      return <NotePayload payload={payload} />;
    default:                    return <FallbackPayload payload={payload} />;
  }
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function EpicActivityModal({ activity, onClose }: Props) {
  if (!activity) return null;
  const cfg = ACTION_CONFIG[activity.action_type] ?? ACTION_CONFIG.activity_logged;

  return (
    <Dialog open={!!activity} onOpenChange={open => !open && onClose()}>
      <DialogContent className="border-cream-300 bg-white text-warm-900 max-w-lg p-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cream-200 bg-cream-50">
          <div className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center text-xl", cfg.bg)}>
              {cfg.icon}
            </div>
            <div>
              <DialogTitle className={cn("text-sm font-semibold", cfg.color)}>
                {cfg.label}
              </DialogTitle>
              <p className="text-[11px] text-cream-500 mt-0.5">
                Applied Epic · {new Date(activity.timestamp).toLocaleString([], {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {/* Description */}
          <div>
            <p className="text-[10px] font-semibold text-cream-500 uppercase tracking-widest mb-1.5">Summary</p>
            <p className="text-sm text-warm-900 leading-relaxed">{activity.description}</p>
          </div>

          {/* Smart payload */}
          <div>
            <p className="text-[10px] font-semibold text-cream-500 uppercase tracking-widest mb-2">Details</p>
            <PayloadRenderer actionType={activity.action_type} payload={activity.payload} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[10px] text-cream-400 pt-1 border-t border-cream-200">
            <span>Conv: {activity.conversation_id}</span>
            <span>ID: {activity.id.slice(0, 12)}…</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
