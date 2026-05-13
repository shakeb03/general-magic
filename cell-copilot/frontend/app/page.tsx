"use client";

import { useEffect } from "react";
import { connectSSE } from "@/lib/sse";
import { api } from "@/lib/api";
import { useUIStore } from "@/stores/useUIStore";
import { ConversationQueue } from "@/components/ConversationQueue";
import { ConversationView } from "@/components/ConversationView";
import { AMSActivityLog } from "@/components/AMSActivityLog";

export default function Home() {
  const {
    handleSnapshot,
    handleMessage,
    handleConvUpdated,
    handleFlag,
    handleOpportunity,
    handleAMSActivity,
    handleReset,
  } = useUIStore();

  useEffect(() => {
    function attach() {
      return connectSSE({
        onSnapshot: handleSnapshot,
        onMessage: handleMessage,
        onConversationUpdated: handleConvUpdated,
        onFlag: handleFlag,
        onOpportunity: handleOpportunity,
        onAMSActivity: handleAMSActivity,
        onReset: () => { handleReset(); setTimeout(attach, 300); },
      });
    }
    const disconnect = attach();
    return disconnect;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden flex-col bg-cream-100">
      {/* Mobile guard */}
      <div className="xl:hidden fixed inset-0 bg-cream-100 flex items-center justify-center z-50">
        <p className="text-warm-700 text-sm">This demo requires a desktop browser (1200px+).</p>
      </div>

      {/* Top bar */}
      <div className="h-12 flex-shrink-0 border-b border-cream-300 bg-cream-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <span className="font-serif text-lg font-bold text-warm-900 tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Cell Co-Pilot
          </span>
          <span className="text-cream-400 text-sm">·</span>
          <span className="text-xs text-warm-700 font-medium">Northgate Insurance</span>
          <div className="flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-700 font-medium">Live</span>
          </div>
        </div>
        <button
          onClick={() => api.reset()}
          className="text-xs text-warm-700 hover:text-coral-500 transition-colors px-3 py-1.5 rounded-md hover:bg-coral-50 border border-transparent hover:border-coral-200"
        >
          Reset demo
        </button>
      </div>

      {/* Three panels */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[22%] min-w-[210px] flex-shrink-0">
          <ConversationQueue />
        </div>
        <div className="flex-1 min-w-0">
          <ConversationView />
        </div>
        <div className="w-[27%] min-w-[260px] flex-shrink-0">
          <AMSActivityLog />
        </div>
      </div>
    </div>
  );
}
