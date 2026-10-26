"use client";

import React, { useState, useEffect, useRef } from "react";
import DashboardShell from "@/components/DashboardShell";
import {
  Search,
  Bot,
  User,
  Send,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  Filter,
  Check,
  RefreshCw,
  Info
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  Conversation,
  ChatMessage,
  BusinessConfig,
  fetchConversations,
  fetchConversationMessages,
  toggleAiMode,
  sendManualOperatorMessage,
  fetchBusinessConfig
} from "@/lib/api";

export default function LiveInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ai_active" | "human_takeover">("all");

  // Operator manual reply
  const [manualText, setManualText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const clientLabel = config?.client_label || "Client";
  const providerLabel = config?.provider_label || "Provider";
  const businessName = config?.business_name || "Universal AI Engine";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load config & conversations
  useEffect(() => {
    fetchBusinessConfig()
      .then((cfg) => {
        if (cfg) setConfig(cfg);
      })
      .catch(() => {});
  }, []);

  const loadConversations = async (autoSelectFirst = true) => {
    try {
      const convs = await fetchConversations();
      if (convs && convs.length > 0) {
        setConversations(convs);
        if (autoSelectFirst && !selectedConvId) {
          setSelectedConvId(convs[0].id);
        }
      } else {
        // High quality universal demo conversations
        const sampleConvs: Conversation[] = [
          {
            id: "conv-101",
            wa_user_id: "919876543210",
            current_state: "confirmed",
            is_ai_active: true,
            created_at: new Date(Date.now() - 3600000).toISOString(),
            updated_at: new Date().toISOString(),
            last_message: "Your appointment for Consultation & Service is confirmed for 2:30 PM!",
            last_message_sender: "assistant",
            last_message_time: "10 mins ago",
          },
          {
            id: "conv-102",
            wa_user_id: "919812345678",
            current_state: "escalated",
            is_ai_active: false,
            created_at: new Date(Date.now() - 7200000).toISOString(),
            updated_at: new Date().toISOString(),
            last_message: "I need to speak directly with a manager regarding an urgent dispute.",
            last_message_sender: "user",
            last_message_time: "25 mins ago",
          },
          {
            id: "conv-103",
            wa_user_id: "919923456789",
            current_state: "inquiry",
            is_ai_active: true,
            created_at: new Date(Date.now() - 14400000).toISOString(),
            updated_at: new Date().toISOString(),
            last_message: "Do you have open availability tomorrow afternoon and what are the payment terms?",
            last_message_sender: "user",
            last_message_time: "1 hour ago",
          },
        ];
        setConversations(sampleConvs);
        if (autoSelectFirst && !selectedConvId) {
          setSelectedConvId(sampleConvs[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load conversations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConvId) return;

    setLoadingMessages(true);
    fetchConversationMessages(selectedConvId)
      .then((msgs) => {
        if (msgs && msgs.length > 0) {
          setMessages(msgs);
        } else {
          if (selectedConvId === "conv-102") {
            setMessages([
              {
                id: "m1",
                conversation_id: selectedConvId,
                sender: "user",
                content: "Hello, I visited your location yesterday for a scheduled appointment.",
                created_at: "10:14 AM",
              },
              {
                id: "m2",
                conversation_id: selectedConvId,
                sender: "assistant",
                content: `Hello! Welcome to ${businessName} AI Assistant. How may we assist you today?`,
                created_at: "10:14 AM",
              },
              {
                id: "m3",
                conversation_id: selectedConvId,
                sender: "user",
                content: "I need to speak directly with a manager regarding an urgent dispute.",
                created_at: "10:16 AM",
              },
              {
                id: "m4",
                conversation_id: selectedConvId,
                sender: "assistant",
                content: "🚨 I have escalated this conversation directly to our human desk staff. An operator will respond here shortly.",
                created_at: "10:16 AM",
              },
            ]);
          } else {
            setMessages([
              {
                id: "m1",
                conversation_id: selectedConvId,
                sender: "user",
                content: "Hi, I would like to book an appointment for this afternoon.",
                created_at: "09:30 AM",
              },
              {
                id: "m2",
                conversation_id: selectedConvId,
                sender: "assistant",
                content: `Hello! Welcome to ${businessName}. We have an open slot today at 02:30 PM. May I have your full name to reserve it?`,
                created_at: "09:30 AM",
              },
              {
                id: "m3",
                conversation_id: selectedConvId,
                sender: "user",
                content: "Yes please, my name is Rahul Sharma.",
                created_at: "09:32 AM",
              },
              {
                id: "m4",
                conversation_id: selectedConvId,
                sender: "assistant",
                content: "Done! Your appointment is confirmed for Today, 2:30 PM. We have reserved your slot without overlap.",
                created_at: "09:33 AM",
              },
            ]);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));

    const channel = supabase
      .channel(`realtime-inbox-${selectedConvId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConvId, businessName]);

  const activeConv = conversations.find((c) => c.id === selectedConvId);

  // Toggle AI Autonomous Mode
  const handleToggleAi = async () => {
    if (!activeConv) return;
    const nextState = !activeConv.is_ai_active;

    setConversations((prev) =>
      prev.map((c) => (c.id === activeConv.id ? { ...c, is_ai_active: nextState } : c))
    );

    try {
      await toggleAiMode(activeConv.id, nextState);
      setToastMessage(
        nextState
          ? "AI Autonomous Mode enabled. Agent will auto-reply."
          : "Human Takeover active. AI replies paused for this thread."
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error("Failed to toggle AI mode", err);
    }
  };

  // Send Manual Operator Message
  const handleSendManual = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!manualText.trim() || !activeConv || isSending) return;

    const messageContent = manualText.trim();
    setManualText("");
    setIsSending(true);

    const tempMsg: ChatMessage = {
      id: `op_${Date.now()}`,
      conversation_id: activeConv.id,
      sender: "operator",
      content: messageContent,
      created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      await sendManualOperatorMessage(
        activeConv.id,
        activeConv.wa_user_id,
        messageContent
      );
      setToastMessage("Operator message dispatched to WhatsApp!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.warn("Operator message stored locally", err);
    } finally {
      setIsSending(false);
    }
  };

  // Filter conversations
  const filteredConvs = conversations.filter((c) => {
    const matchesSearch =
      c.wa_user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.last_message || "").toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "ai_active") return c.is_ai_active !== false;
    if (statusFilter === "human_takeover") return c.is_ai_active === false || c.current_state === "escalated";
    return true;
  });

  return (
    <DashboardShell onRefresh={() => loadConversations(false)}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-zinc-900 bg-[#09090B] px-4 py-2.5 text-xs font-medium text-white shadow-xl animate-in fade-in duration-150">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="border-b border-[#E4E4E7] bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-zinc-900">{businessName}</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-500">Live Inbox</span>
          </div>
          <button
            onClick={() => loadConversations(false)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3 w-3 text-zinc-500" />
            <span>Sync WhatsApp Threads</span>
          </button>
        </div>
      </header>

      {/* Split View Container */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>
        {/* Left Side: Threads List */}
        <aside className="w-full sm:w-80 md:w-96 flex flex-col border-r border-[#E4E4E7] bg-white">
          <div className="p-3.5 border-b border-[#E4E4E7] space-y-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder={`Search ${clientLabel.toLowerCase()} phone or text...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-[#E4E4E7] bg-zinc-50/70 pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5">
              {[
                { id: "all", label: "All Threads" },
                { id: "ai_active", label: "AI Autonomous" },
                { id: "human_takeover", label: "Human Operator" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                    statusFilter === f.id
                      ? "bg-[#09090B] text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E4E4E7]">
            {filteredConvs.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const isAi = conv.is_ai_active !== false && conv.current_state !== "escalated";

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`cursor-pointer p-3.5 transition-colors ${
                    isSelected ? "bg-zinc-100/90" : "hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white font-mono text-[11px] font-semibold">
                        {conv.wa_user_id.slice(-2)}
                      </div>
                      <span className="font-mono text-xs font-semibold text-zinc-900">
                        +{conv.wa_user_id}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      {conv.last_message_time || "Recent"}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-xs text-zinc-600 mt-1 leading-relaxed">
                    {conv.last_message || "No message content"}
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    {isAi ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        AI Autonomous
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200/60">
                        <ShieldAlert className="h-2.5 w-2.5" />
                        Human Operator
                      </span>
                    )}

                    <span className="text-[10px] text-zinc-400 uppercase font-mono">
                      {conv.current_state}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredConvs.length === 0 && (
              <div className="p-8 text-center text-xs text-zinc-400">
                No matching WhatsApp threads found
              </div>
            )}
          </div>
        </aside>

        {/* Right Side: Real-time Message Thread */}
        <section className="flex-1 flex flex-col bg-white overflow-hidden">
          {activeConv ? (
            <>
              {/* Top Bar: AI Autonomous vs Human Operator Toggle */}
              <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#E4E4E7] bg-white px-6 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#09090B] text-white">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono text-xs font-bold text-[#09090B]">
                        +{activeConv.wa_user_id}
                      </h3>
                      {activeConv.is_ai_active !== false && activeConv.current_state !== "escalated" ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                          ● AI Autonomous
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200/60">
                          Human Operator Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Channel: WhatsApp Business API • State: {activeConv.current_state}
                    </p>
                  </div>
                </div>

                {/* AI Autonomous Mode Toggle Switch */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-zinc-700 hidden sm:inline">
                    {activeConv.is_ai_active !== false && activeConv.current_state !== "escalated"
                      ? "AI Autonomous"
                      : "Human Operator"}
                  </span>
                  <button
                    onClick={handleToggleAi}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      activeConv.is_ai_active !== false && activeConv.current_state !== "escalated"
                        ? "bg-[#09090B]"
                        : "bg-zinc-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        activeConv.is_ai_active !== false && activeConv.current_state !== "escalated"
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Informational Banner */}
              {activeConv.is_ai_active !== false && activeConv.current_state !== "escalated" && (
                <div className="flex items-center justify-between border-b border-[#E4E4E7] bg-zinc-50/70 px-6 py-2 text-xs text-zinc-600">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-zinc-900" />
                    <span>
                      AI autonomous mode is responding to {clientLabel.toLowerCase()} questions and booking slots via Groq LPU.
                    </span>
                  </div>
                  <button
                    onClick={handleToggleAi}
                    className="font-medium text-zinc-900 underline hover:text-black cursor-pointer text-[11px]"
                  >
                    Take Over Conversation
                  </button>
                </div>
              )}

              {/* Messages Thread Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                {messages.map((msg) => {
                  const isClient = msg.sender === "user";
                  const isAi = msg.sender === "assistant";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isClient ? "items-start" : "items-end"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        {isClient ? (
                          <>
                            <span className="text-[11px] font-semibold text-zinc-900">
                              {clientLabel} (+{activeConv.wa_user_id})
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </>
                        ) : isAi ? (
                          <>
                            <span className="text-[10px] text-zinc-400">
                              {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-900">
                              AI Receptionist
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] text-zinc-400">
                              {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-900">
                              Operator (Human)
                            </span>
                          </>
                        )}
                      </div>

                      <div
                        className={`max-w-[70%] px-4 py-2.5 text-xs leading-relaxed shadow-2xs ${
                          isClient
                            ? "bg-zinc-100 text-[#09090B] rounded-2xl rounded-tl-xs border border-zinc-200"
                            : isAi
                            ? "bg-[#09090B] text-white rounded-2xl rounded-tr-xs"
                            : "bg-white text-zinc-900 rounded-2xl rounded-tr-xs border-2 border-zinc-900"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Message Input Box */}
              <div className="border-t border-[#E4E4E7] bg-white p-4">
                <form
                  onSubmit={handleSendManual}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder={`Reply as human operator to +${activeConv.wa_user_id}...`}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    className="flex-1 rounded-xl border border-[#E4E4E7] bg-zinc-50/70 px-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={!manualText.trim() || isSending}
                    className="flex items-center gap-1.5 rounded-xl bg-[#09090B] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 text-xs">
              Select a conversation to view WhatsApp thread
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
