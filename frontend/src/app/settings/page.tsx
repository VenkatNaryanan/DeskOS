"use client";

import React, { useState, useEffect } from "react";
import DashboardShell from "@/components/DashboardShell";
import {
  Sliders,
  Building2,
  Phone,
  ShieldCheck,
  Bot,
  Save,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Cpu,
  Check,
  Tag,
  DollarSign
} from "lucide-react";
import {
  BusinessConfig,
  IndustryType,
  fetchBusinessConfig,
  updateBusinessConfig,
  applyIndustryPreset
} from "@/lib/api";

interface PresetItem {
  key: IndustryType;
  title: string;
  emoji: string;
  clientLabel: string;
  providerLabel: string;
}

const PRESETS: PresetItem[] = [
  { key: "healthcare", title: "Healthcare & Dental", emoji: "🏥", clientLabel: "Patient", providerLabel: "Doctor" },
  { key: "salon", title: "Salon, Spa & Wellness", emoji: "✂️", clientLabel: "Guest", providerLabel: "Stylist" },
  { key: "legal", title: "Legal & Financial", emoji: "⚖️", clientLabel: "Client", providerLabel: "Advisor" },
  { key: "auto", title: "Auto Detailing & Repair", emoji: "🚗", clientLabel: "Car Owner", providerLabel: "Mechanic" },
  { key: "custom", title: "Custom / General", emoji: "🏢", clientLabel: "Client", providerLabel: "Specialist" },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [activePreset, setActivePreset] = useState<IndustryType>("healthcare");
  const [businessName, setBusinessName] = useState("Apex Healthcare & Dental Clinic");
  const [clientLabel, setClientLabel] = useState("Patient");
  const [providerLabel, setProviderLabel] = useState("Doctor");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [address, setAddress] = useState("12th Floor, Green Tower, MG Road, Bengaluru - 560001");
  const [tone, setTone] = useState("Empathetic, reassuring, clinically precise, and patient-first");
  const [currencySymbol, setCurrencySymbol] = useState("₹");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchBusinessConfig()
      .then((cfg) => {
        if (cfg) {
          setConfig(cfg);
          if (cfg.industry) setActivePreset(cfg.industry);
          if (cfg.business_name) setBusinessName(cfg.business_name);
          if (cfg.client_label) setClientLabel(cfg.client_label);
          if (cfg.provider_label) setProviderLabel(cfg.provider_label);
          if (cfg.tone) setTone(cfg.tone);
          if (cfg.currency_symbol) setCurrencySymbol(cfg.currency_symbol);
        }
      })
      .catch((err) => console.error("Could not fetch settings config", err));
  }, []);

  const handleSelectPreset = async (presetKey: IndustryType) => {
    setActivePreset(presetKey);
    setIsSaving(true);
    try {
      const res = await applyIndustryPreset(presetKey);
      if (res && res.config) {
        const c = res.config;
        setConfig(c);
        if (c.business_name) setBusinessName(c.business_name);
        if (c.client_label) setClientLabel(c.client_label);
        if (c.provider_label) setProviderLabel(c.provider_label);
        if (c.tone) setTone(c.tone);
        if (c.currency_symbol) setCurrencySymbol(c.currency_symbol);
      }
      setToastMessage(`Switched preset to ${presetKey.toUpperCase()}! Synchronized with Supabase & Groq.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      const matched = PRESETS.find((p) => p.key === presetKey);
      if (matched) {
        setClientLabel(matched.clientLabel);
        setProviderLabel(matched.providerLabel);
      }
      setToastMessage(`Preset updated. Click "Save Settings" to persist.`);
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateBusinessConfig({
        business_name: businessName,
        industry: activePreset,
        client_label: clientLabel,
        provider_label: providerLabel,
        tone,
        currency_symbol: currencySymbol,
      });
      setToastMessage("Settings saved successfully and synced with AI engine.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      alert("Failed to save settings. Please verify backend is running.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardShell>
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-zinc-900 bg-[#09090B] px-4 py-2.5 text-xs font-medium text-white shadow-xl animate-in fade-in duration-150">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-[#E4E4E7] bg-white px-6 py-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-zinc-900">{businessName}</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-zinc-500">System</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-zinc-900 font-medium">Platform & Industry Settings</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 space-y-6 max-w-4xl">
        {/* Industry Preset Selector */}
        <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-zinc-900" />
              <h3 className="text-xs font-semibold text-[#09090B]">
                Industry Preset Selector (1-Click Switch)
              </h3>
            </div>
            <span className="text-[11px] text-zinc-500">
              Instantly adapts labels, defaults, and LLM reasoning
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {PRESETS.map((p) => {
              const isSelected = activePreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleSelectPreset(p.key)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 shadow-xs"
                      : "border-[#E4E4E7] bg-white hover:border-zinc-300 hover:bg-zinc-50/50"
                  }`}
                >
                  <span className="text-xl mb-1">{p.emoji}</span>
                  <span className="text-[11px] font-semibold text-zinc-900 leading-tight">
                    {p.title}
                  </span>
                  <span className="mt-1 text-[10px] text-zinc-500">
                    {p.clientLabel} • {p.providerLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Business Profile & Terminology */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E4E4E7]">
              <Building2 className="h-4 w-4 text-zinc-700" />
              <h3 className="text-xs font-semibold text-[#09090B]">
                Business Profile & Terminology
              </h3>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Business Legal Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Client Label (e.g. Patient, Guest, Client, Car Owner)
                </label>
                <input
                  type="text"
                  value={clientLabel}
                  onChange={(e) => setClientLabel(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Provider Label (e.g. Doctor, Stylist, Advisor, Mechanic)
                </label>
                <input
                  type="text"
                  value={providerLabel}
                  onChange={(e) => setProviderLabel(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  WhatsApp Contact Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 font-mono focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Business Address & Location Directions
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                  Conversational Persona & Tone
                </label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Meta WhatsApp Cloud API Status */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-semibold text-[#09090B]">
                  Meta WhatsApp Cloud API Integration
                </h3>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Webhook Connected
              </span>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Inbound Webhook Endpoint</span>
                <span className="font-mono text-zinc-800">/api/webhook/whatsapp</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Meta API Version</span>
                <span className="font-mono text-zinc-800">v21.0 (Cloud API)</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-500">Database Engine</span>
                <span className="font-medium text-zinc-800">Supabase Postgres (universal_businesses, universal_bookings)</span>
              </div>
            </div>
          </div>

          {/* Section 3: AI Engine Parameters */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E4E4E7]">
              <Cpu className="h-4 w-4 text-zinc-700" />
              <h3 className="text-xs font-semibold text-[#09090B]">
                AI Model Engine (Groq LPUs)
              </h3>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Conversational Reasoning Model</span>
                <span className="font-mono font-medium text-zinc-800">llama-3.3-70b-versatile</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Voice Audio Transcription</span>
                <span className="font-mono font-medium text-zinc-800">whisper-large-v3</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-zinc-500">Active Autonomous Tools</span>
                <span className="font-medium text-emerald-700">
                  check_and_book_appointment, escalate_to_human, emergency_notice_check
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-[#09090B] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : "Save Settings"}</span>
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
