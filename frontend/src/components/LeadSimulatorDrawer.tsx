"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Mic,
  MicOff,
  Sparkles,
  RefreshCw,
  Phone,
  Wrench,
  Bot
} from "lucide-react";
import { simulateIncomingMessage, simulateVoiceUpload, fetchBusinessConfig, BusinessConfig } from "@/lib/api";

interface SimulatorMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  time: string;
  tools?: string[];
  isVoice?: boolean;
}

interface LeadSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshParent?: () => void;
}

const INDUSTRY_PROMPTS: Record<string, string[]> = {
  healthcare: [
    "Book a dental checkup tomorrow 3pm",
    "Are you open on Friday for holiday?",
    "What is the price of Root Canal Treatment?",
    "Do you accept cashless health insurance?",
    "I have severe tooth pain right now, can I come?"
  ],
  salon: [
    "Book a haircut & blowdry tomorrow 3pm",
    "Can I book a deep tissue aroma spa this weekend?",
    "What are your HydraFacial rates?",
    "Do I need to wash my hair before coming?",
    "Can I request a senior master stylist?"
  ],
  legal: [
    "Book a 30-min legal consultation tomorrow 11am",
    "What are your corporate tax audit fees?",
    "Are our WhatsApp discussions confidential?",
    "I received an urgent court notice, need advice",
    "Can consultations be done on Zoom / video?"
  ],
  auto: [
    "Book a car service & inspection tomorrow 9am",
    "What is the cost of 9H ceramic coating detailing?",
    "Do you offer free doorstep pickup and drop?",
    "My car brake pads are squeaking, can you fix it?",
    "My engine is smoking, I need emergency towing"
  ],
  custom: [
    "Book an appointment tomorrow at 2pm",
    "What are your standard service charges?",
    "What are your operating hours this week?",
    "How can I speak to a human manager?"
  ]
};

export default function LeadSimulatorDrawer({
  isOpen,
  onClose,
  onRefreshParent,
}: LeadSimulatorDrawerProps) {
  const [phoneNumber, setPhoneNumber] = useState("+91 98765 43210");
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<BusinessConfig | null>(null);

  const [messages, setMessages] = useState<SimulatorMessage[]>([
    {
      id: "initial",
      sender: "assistant",
      content: "Hello! Welcome to our 24/7 AI Receptionist. How can I assist you with scheduling an appointment or answering questions today?",
      time: "Just now",
    },
  ]);

  useEffect(() => {
    fetchBusinessConfig()
      .then((cfg) => {
        if (cfg) {
          setConfig(cfg);
          setMessages([
            {
              id: "initial",
              sender: "assistant",
              content: `Hello! Welcome to ${cfg.business_name}. I am your 24/7 AI Assistant. How may I help you with booking an appointment or answering your questions today?`,
              time: "Just now",
            },
          ]);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const industry = config?.industry || "healthcare";
  const clientLabel = config?.client_label || "Client";
  const businessName = config?.business_name || "Universal AI Receptionist";
  const quickPrompts = INDUSTRY_PROMPTS[industry] || INDUSTRY_PROMPTS.custom;

  const handleSendText = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText("");
    const userMsg: SimulatorMessage = {
      id: `u_${Date.now()}`,
      sender: "user",
      content: text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, "") || "919876543210";
      const res = await simulateIncomingMessage(cleanPhone, text, config?.business_id || "default_business");

      const replyText =
        res.reply_text ||
        res.assistant_message?.content ||
        "I have processed your query. Let me know if you need anything else!";

      const toolCalls = res.tool_calls || [];
      const toolNames = toolCalls.map((t: any) => t.tool_name || t.name || "agent_tool");

      const aiMsg: SimulatorMessage = {
        id: `a_${Date.now()}`,
        sender: "assistant",
        content: replyText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        tools: toolNames.length > 0 ? toolNames : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
      onRefreshParent?.();
    } catch (err: any) {
      const errorMsg: SimulatorMessage = {
        id: `err_${Date.now()}`,
        sender: "assistant",
        content:
          "⚠️ Simulator Error: Could not connect to local engine. Ensure backend is running at http://localhost:8000.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await processVoiceAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access failed", err);
      alert("Please allow microphone access to test voice notes.");
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceAudio = async (blob: Blob) => {
    setIsLoading(true);
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, "") || "919876543210";

    const userVoiceMsg: SimulatorMessage = {
      id: `uv_${Date.now()}`,
      sender: "user",
      content: "🎤 [Sending Voice Note...]",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isVoice: true,
    };
    setMessages((prev) => [...prev, userVoiceMsg]);

    try {
      const res = await simulateVoiceUpload(cleanPhone, blob, config?.business_id || "default_business");
      const transcribed = res.transcription || "Voice note received";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === userVoiceMsg.id
            ? { ...m, content: `🎤 "${transcribed}"` }
            : m
        )
      );

      const replyText =
        res.reply_text ||
        res.assistant_message?.content ||
        "I have processed your voice note.";

      const toolCalls = res.tool_calls || [];
      const toolNames = toolCalls.map((t: any) => t.tool_name || t.name || "voice_transcribe");

      const aiMsg: SimulatorMessage = {
        id: `av_${Date.now()}`,
        sender: "assistant",
        content: replyText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        tools: toolNames.length > 0 ? toolNames : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
      onRefreshParent?.();
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userVoiceMsg.id
            ? { ...m, content: "🎤 [Voice note simulation error]" }
            : m
        )
      );
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "assistant",
          content: "⚠️ Voice simulation failed. Check backend Groq Whisper key or connection.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dimmed backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/25 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Container */}
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-[#E4E4E7] bg-white shadow-2xl z-10 animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#E4E4E7] px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-xs">
              <Sparkles className="h-4 w-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#09090B]">
                  Universal AI Simulator
                </h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200/50 capitalize">
                  {industry} Engine
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Test WhatsApp messages, speech notes & tool executions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Simulator Meta Settings */}
        <div className="border-b border-[#E4E4E7] bg-zinc-50/70 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#E4E4E7] bg-white px-2.5 py-1.5 text-xs">
              <Phone className="h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="WhatsApp Number"
                className="w-full text-xs font-mono font-medium text-zinc-900 focus:outline-hidden"
              />
            </div>
            <button
              onClick={() =>
                setMessages([
                  {
                    id: "init",
                    sender: "assistant",
                    content: `Hello! Welcome to ${businessName}. How may I help you?`,
                    time: "Just now",
                  },
                ])
              }
              className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
              title="Reset Chat"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Quick Prompts Chips */}
          <div className="mt-2.5">
            <div className="text-[10px] font-semibold text-zinc-400 tracking-wider uppercase mb-1.5">
              Quick Test Prompts ({industry})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendText(prompt)}
                  disabled={isLoading}
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 transition-all text-left truncate max-w-full cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Messages Feed */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-white"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                {msg.sender === "user" ? (
                  <>
                    <span className="text-[10px] text-zinc-400">{msg.time}</span>
                    <span className="text-[11px] font-semibold text-zinc-800">
                      Simulated {clientLabel}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold text-zinc-900">
                      AI Receptionist
                    </span>
                    <span className="text-[10px] text-zinc-400">{msg.time}</span>
                  </>
                )}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-xs ${
                  msg.sender === "user"
                    ? "bg-zinc-100 text-zinc-900 rounded-tr-xs border border-zinc-200"
                    : "bg-[#09090B] text-white rounded-tl-xs"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Tool calls execution badge */}
                {msg.tools && msg.tools.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-800 flex flex-wrap gap-1">
                    {msg.tools.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400"
                      >
                        <Wrench className="h-2.5 w-2.5" />
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading bubble */}
          {isLoading && (
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[11px] font-semibold text-zinc-900">
                  AI Receptionist
                </span>
                <span className="text-[10px] text-zinc-400">Thinking...</span>
              </div>
              <div className="rounded-2xl rounded-tl-xs bg-[#09090B] px-4 py-3 text-xs text-zinc-300 shadow-xs flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Groq LPU reasoning in progress...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar with Voice & Send */}
        <div className="border-t border-[#E4E4E7] p-4 bg-zinc-50/50">
          {/* Active Voice Recording Bar */}
          {isRecording && (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3.5 py-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
                </span>
                <span className="text-xs font-semibold text-red-700">
                  Recording Voice Note ({recordingSeconds}s)...
                </span>
              </div>
              <button
                onClick={stopVoiceRecording}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
              >
                Stop & Transcribe
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendText();
            }}
            className="flex items-center gap-2"
          >
            {/* Mic trigger */}
            <button
              type="button"
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              disabled={isLoading}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                isRecording
                  ? "border-red-400 bg-red-500 text-white animate-pulse"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-black"
              }`}
              title={isRecording ? "Stop recording" : "Record WhatsApp voice note"}
            >
              {isRecording ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            {/* Text input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Type simulated WhatsApp query as ${clientLabel}...`}
              disabled={isLoading || isRecording}
              className="flex-1 rounded-xl border border-[#E4E4E7] bg-white px-3.5 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden"
            />

            {/* Solid black send button */}
            <button
              type="submit"
              disabled={isLoading || !inputText.trim() || isRecording}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#09090B] text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
              title="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-2 text-center text-[10px] text-zinc-400">
            Simulates inbound Meta WhatsApp messages with native multi-industry tool calling.
          </div>
        </div>
      </div>
    </div>
  );
}
