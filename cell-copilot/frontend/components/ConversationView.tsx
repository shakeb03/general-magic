"use client";

import { useState, useRef, useEffect } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { api } from "@/lib/api";
import { ReasoningStrip } from "./ReasoningStrip";
import { FlagBanner } from "./FlagBanner";
import { cn } from "@/lib/utils";

const LOB_BADGE: Record<string, string> = {
  auto:       "text-blue-700 bg-blue-50 border border-blue-200",
  home:       "text-emerald-700 bg-emerald-50 border border-emerald-200",
  commercial: "text-orange-700 bg-orange-50 border border-orange-200",
  life:       "text-purple-700 bg-purple-50 border border-purple-200",
  billing:    "text-warm-700 bg-cream-200 border border-cream-300",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function ConversationView() {
  const { activeConvId, conversations, messages } = useUIStore();
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isHandingBack, setIsHandingBack] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conv = conversations.find(c => c.id === activeConvId);
  const convMessages = activeConvId ? (messages[activeConvId] ?? []) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convMessages.length]);

  if (!activeConvId || !conv) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 bg-white border-r border-cream-200">
        <div className="w-12 h-12 rounded-full bg-cream-200 flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M4 4h14a2 2 0 012 2v9a2 2 0 01-2 2H7l-5 3V6a2 2 0 012-2z" stroke="#C8C0B4" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-sm text-cream-500">Select a conversation to view</p>
      </div>
    );
  }

  const isBrokerMode = conv.control === "broker";

  const handleTakeover = async () => { await api.takeover(conv.id); };
  const handleHandback = async () => {
    setIsHandingBack(true);
    try { await api.handback(conv.id); setInputText(""); }
    finally { setIsHandingBack(false); }
  };
  const handleSuggest = async () => {
    setIsSuggesting(true);
    try { const { draft } = await api.suggestReply(conv.id); setInputText(draft); }
    finally { setIsSuggesting(false); }
  };
  const handleSend = async () => {
    if (!inputText.trim()) return;
    setIsSending(true);
    try { await api.sendMessage(conv.id, inputText.trim()); setInputText(""); }
    finally { setIsSending(false); }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-cream-200">

      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-cream-200 bg-cream-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-sm font-semibold text-warm-900">{conv.customer_name}</h2>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide", LOB_BADGE[conv.line_of_business])}>
                  {conv.line_of_business}
                </span>
                {isBrokerMode && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide text-coral-600 bg-coral-50 border border-coral-200">
                    Broker Control
                  </span>
                )}
                {conv.status === "resolved" && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200">
                    Resolved
                  </span>
                )}
              </div>
              <p className="text-xs text-warm-700">{conv.customer_phone}</p>
            </div>
          </div>
          <p className="text-xs text-warm-700 italic">{conv.current_activity}</p>
        </div>
      </div>

      {/* Reasoning strip */}
      <div className="flex-shrink-0">
        <ReasoningStrip convId={conv.id} />
      </div>

      {/* Flag banner */}
      <div className="flex-shrink-0">
        <FlagBanner convId={conv.id} />
      </div>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin bg-white">
        {convMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
            <div className="w-8 h-8 rounded-full border border-cream-300 flex items-center justify-center animate-pulse">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5" stroke="#C8C0B4" strokeWidth="1.5" strokeDasharray="2 2"/>
              </svg>
            </div>
            <p className="text-xs text-cream-500">Waiting for first message…</p>
          </div>
        )}

        {convMessages.map((msg, i) => {
          const isCustomer = msg.sender === "customer";
          const isBroker = msg.sender === "broker";
          const showSeparator = i === 0 || i % 4 === 0;

          return (
            <div key={msg.id}>
              {showSeparator && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-cream-200" />
                  <span className="text-[10px] text-cream-500 px-2">
                    {formatDate(msg.timestamp)} · {formatTime(msg.timestamp)}
                  </span>
                  <div className="flex-1 h-px bg-cream-200" />
                </div>
              )}

              <div className={cn("flex gap-2.5", isCustomer ? "justify-start" : "justify-end")}>
                {isCustomer && (
                  <div className="w-6 h-6 rounded-full bg-cream-200 flex items-center justify-center text-[9px] font-bold text-warm-700 flex-shrink-0 mt-1">
                    {conv.customer_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                )}

                <div className={cn("max-w-[72%] flex flex-col gap-1", isCustomer ? "items-start" : "items-end")}>
                  {(msg.sender === "agent" || isBroker) && (
                    <span className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide px-0.5",
                      isBroker ? "text-coral-500" : "text-warm-700"
                    )}>
                      {isBroker ? "You (Broker)" : "AI Agent"}
                    </span>
                  )}

                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                    isCustomer
                      ? "message-bubble-customer rounded-tl-sm"
                      : isBroker
                      ? "message-bubble-broker rounded-tr-sm"
                      : "message-bubble-agent rounded-tr-sm"
                  )}>
                    {msg.content}
                  </div>

                  {!showSeparator && (
                    <span className="text-[10px] text-cream-400 px-1">
                      {formatTime(msg.timestamp)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-cream-200 p-4 bg-cream-50">
        {/* Action buttons */}
        <div className="flex items-center gap-2 mb-3">
          {!isBrokerMode ? (
            <button
              onClick={handleTakeover}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-coral-500 hover:bg-coral-600 text-white rounded-lg font-semibold transition-all shadow-sm"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M5.5 1v4.5M5.5 5.5l3-2M5.5 5.5l-3-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                <path d="M2 7.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Take over
            </button>
          ) : (
            <>
              <button
                onClick={handleSuggest}
                disabled={isSuggesting}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white hover:bg-cream-50 text-warm-800 rounded-lg font-medium transition-all border border-cream-300 disabled:opacity-50"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1 5.5C1 3 3 1 5.5 1S10 3 10 5.5 8 10 5.5 10 1 8 1 5.5z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5.5 3.5v2.5M5.5 7.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {isSuggesting ? "Drafting…" : "Suggest reply"}
              </button>
              <button
                onClick={handleHandback}
                disabled={isHandingBack}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white hover:bg-cream-50 text-warm-800 rounded-lg font-medium transition-all border border-cream-300 disabled:opacity-50"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M8 2.5L5 5.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 2.5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                {isHandingBack ? "Handing back…" : "Hand back"}
              </button>
            </>
          )}
        </div>

        {/* Text input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={isBrokerMode ? "Type a message and press Enter…" : "Take over to send a message"}
            disabled={!isBrokerMode || isSending}
            className="flex-1 bg-white border border-cream-300 rounded-xl px-4 py-2.5 text-sm text-warm-900 placeholder-cream-400 focus:outline-none focus:border-coral-400 focus:ring-1 focus:ring-coral-200 disabled:opacity-40 transition-all"
          />
          {isBrokerMode && (
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isSending}
              className="px-4 py-2.5 bg-coral-500 hover:bg-coral-600 text-white text-sm rounded-xl font-semibold transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
