"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import {
  Clock,
  Tag,
  BookOpen,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Pencil,
  Check,
  X,
  Sliders,
  ShieldAlert,
  Building2,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Volume2,
  DollarSign,
  UserCheck,
  Stethoscope,
  Scissors,
  Scale,
  Wrench,
  Layers
} from "lucide-react";
import {
  BusinessConfig,
  OperatingHours,
  ServiceItem,
  FaqItem,
  BroadcastNotice,
  IndustryType,
  fetchBusinessConfig,
  updateBusinessConfig,
  applyIndustryPreset
} from "@/lib/api";

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

interface PresetTemplate {
  key: IndustryType;
  title: string;
  emoji: string;
  clientLabel: string;
  providerLabel: string;
  tone: string;
  description: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    key: "healthcare",
    title: "Healthcare & Dental",
    emoji: "🏥",
    clientLabel: "Patient",
    providerLabel: "Doctor",
    tone: "Empathetic, reassuring, clinically precise, and patient-first",
    description: "Ideal for dental clinics, GPs, pediatricians, and specialized healthcare practices.",
  },
  {
    key: "salon",
    title: "Salon, Spa & Wellness",
    emoji: "✂️",
    clientLabel: "Guest",
    providerLabel: "Stylist",
    tone: "Warm, luxurious, welcoming, and relaxed hospitality",
    description: "Tailored for hair salons, day spas, massage centers, and beauty wellness clinics.",
  },
  {
    key: "legal",
    title: "Legal & Financial",
    emoji: "⚖️",
    clientLabel: "Client",
    providerLabel: "Advisor",
    tone: "Professional, confidential, authoritative, and articulate",
    description: "Designed for law firms, chartered accountants, tax consultants, and financial planners.",
  },
  {
    key: "auto",
    title: "Auto Detailing & Repair",
    emoji: "🚗",
    clientLabel: "Car Owner",
    providerLabel: "Mechanic",
    tone: "Clear, reliable, transparent on pricing, and prompt",
    description: "Optimized for auto body shops, ceramic detailing studios, and routine car maintenance.",
  },
  {
    key: "custom",
    title: "Custom / General",
    emoji: "🏢",
    clientLabel: "Client",
    providerLabel: "Specialist",
    tone: "Helpful, adaptable, courteous, and efficient",
    description: "Configure bespoke terminology and workflow for any appointments-based business.",
  },
];

interface ReceptionistConfigContentProps {
  initialSection?: "identity" | "hours" | "services" | "faqs" | "escalations";
}

export default function ReceptionistConfigContent({
  initialSection = "identity",
}: ReceptionistConfigContentProps) {
  const router = useRouter();
  const [config, setConfig] = useState<BusinessConfig | null>(null);

  // Tab 1: Identity & Terminology
  const [activePreset, setActivePreset] = useState<IndustryType>("healthcare");
  const [businessName, setBusinessName] = useState("Apex Healthcare & Dental Clinic");
  const [clientLabel, setClientLabel] = useState("Patient");
  const [providerLabel, setProviderLabel] = useState("Doctor");
  const [tone, setTone] = useState("Empathetic, reassuring, clinically precise, and patient-first");
  const [currencySymbol, setCurrencySymbol] = useState("₹");

  // Broadcast Notice / Urgent Banner
  const [broadcastNotice, setBroadcastNotice] = useState<BroadcastNotice>({
    is_active: true,
    notice_text: "Closed tomorrow for inventory / holiday celebration.",
    effective_dates: "Tomorrow, Oct 26",
  });

  // Tab 2: Operating Hours
  const [hours, setHours] = useState<OperatingHours>({
    monday: { is_closed: false, open: "09:00", close: "20:00" },
    tuesday: { is_closed: false, open: "09:00", close: "20:00" },
    wednesday: { is_closed: false, open: "09:00", close: "20:00" },
    thursday: { is_closed: false, open: "09:00", close: "20:00" },
    friday: { is_closed: false, open: "09:00", close: "20:00" },
    saturday: { is_closed: false, open: "10:00", close: "18:00" },
    sunday: { is_closed: true, open: "10:00", close: "14:00" },
  });

  // Tab 3: Services Catalog
  const [services, setServices] = useState<ServiceItem[]>([
    { id: "1", name: "Dental Consultation & Exam", price: 500, duration: "30 mins", category: "General" },
    { id: "2", name: "Teeth Cleaning & Scaling", price: 1500, duration: "45 mins", category: "Preventive" },
    { id: "3", name: "Root Canal Treatment (RCT)", price: 4500, duration: "60 mins", category: "Endodontics" },
    { id: "4", name: "Teeth Whitening", price: 6000, duration: "60 mins", category: "Cosmetic" },
  ]);

  // Tab 4: FAQs
  const [faqs, setFaqs] = useState<FaqItem[]>([
    {
      id: "1",
      question: "Where is the business located and what are parking options?",
      answer: "12th Floor, Green Tower, MG Road (Free parking available in basement level B1 & B2).",
    },
    {
      id: "2",
      question: "Do you accept digital payments and cards?",
      answer: "Yes, we accept UPI, major credit/debit cards, Net Banking, and cash.",
    },
    {
      id: "3",
      question: "Can appointments be rescheduled or canceled?",
      answer: "Yes, please notify us at least 2 hours in advance via WhatsApp to reschedule without penalty.",
    },
  ]);

  // Tab 5: Escalation Rules
  const [escalationRules, setEscalationRules] = useState<string[]>([
    "emergency",
    "severe pain",
    "bleeding",
    "lawsuit",
    "refund",
    "complaint",
    "human",
    "manager",
    "operator",
    "urgent",
  ]);
  const [newKeyword, setNewKeyword] = useState("");

  // Form states for new service & FAQ
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("30 mins");
  const [newServiceCategory, setNewServiceCategory] = useState("General");

  const [newFaqQ, setNewFaqQ] = useState("");
  const [newFaqA, setNewFaqA] = useState("");

  // Edit Service State
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [editServicePrice, setEditServicePrice] = useState("");
  const [editServiceDuration, setEditServiceDuration] = useState("30 mins");
  const [editServiceCategory, setEditServiceCategory] = useState("General");

  // Edit FAQ State
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editFaqQuestion, setEditFaqQuestion] = useState("");
  const [editFaqAnswer, setEditFaqAnswer] = useState("");

  const [activeSection, setActiveSection] = useState<"identity" | "hours" | "services" | "faqs" | "escalations">(
    initialSection
  );
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

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
          if (cfg.operating_hours) setHours(cfg.operating_hours);
          if (cfg.services && cfg.services.length > 0) setServices(cfg.services);
          if (cfg.faqs && cfg.faqs.length > 0) setFaqs(cfg.faqs);
          if (cfg.escalation_rules && cfg.escalation_rules.length > 0) setEscalationRules(cfg.escalation_rules);
          const notice = cfg.broadcast_notice || cfg.emergency_notice;
          if (notice) setBroadcastNotice(notice);
        }
      })
      .catch((err) => console.error("Could not fetch business config", err));
  }, []);

  const handleTabChange = (section: "identity" | "hours" | "services" | "faqs" | "escalations") => {
    setActiveSection(section);
    if (section === "identity") {
      router.push("/receptionist");
    } else if (section === "hours") {
      router.push("/receptionist");
    } else if (section === "services") {
      router.push("/services");
    } else if (section === "faqs") {
      router.push("/knowledge");
    } else if (section === "escalations") {
      router.push("/receptionist");
    }
  };

  const handleApplyPreset = async (presetKey: IndustryType) => {
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
        if (c.services) setServices(c.services);
        if (c.faqs) setFaqs(c.faqs);
        if (c.escalation_rules) setEscalationRules(c.escalation_rules);
        const notice = c.broadcast_notice || c.emergency_notice;
        if (notice) setBroadcastNotice(notice);
      }
      setToastMessage(`Switched to "${presetKey.toUpperCase()}" template! Supabase & Groq AI synchronized.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error("Failed to apply preset via API, updating locally", err);
      // Fallback local update
      const template = PRESET_TEMPLATES.find((p) => p.key === presetKey);
      if (template) {
        setClientLabel(template.clientLabel);
        setProviderLabel(template.providerLabel);
        setTone(template.tone);
        setToastMessage(`Switched terminology to ${template.title}. Click "Save All Changes" to persist.`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await updateBusinessConfig({
        business_name: businessName,
        industry: activePreset,
        client_label: clientLabel,
        provider_label: providerLabel,
        tone,
        currency_symbol: currencySymbol,
        broadcast_notice: broadcastNotice,
        emergency_notice: broadcastNotice,
        operating_hours: hours,
        services,
        faqs,
        escalation_rules: escalationRules,
      });
      setToastMessage("All engine parameters synced with Supabase & Groq AI agent!");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error("Save error", err);
      alert("Failed to update config. Make sure the backend server is running.");
    } finally {
      setIsSaving(false);
    }
  };

  // Service Management
  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim() || !newServicePrice) return;

    const newSrv: ServiceItem = {
      id: `srv_${Date.now()}`,
      name: newServiceName.trim(),
      price: parseFloat(newServicePrice) || 0,
      duration: newServiceDuration,
      category: newServiceCategory,
    };

    setServices((prev) => [...prev, newSrv]);
    setNewServiceName("");
    setNewServicePrice("");
    setToastMessage(`Added "${newSrv.name}" to service catalog! Click "Save All Changes" to sync.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const startEditingService = (item: ServiceItem) => {
    setEditingServiceId(item.id || item.name);
    setEditServiceName(item.name);
    setEditServicePrice(item.price.toString());
    setEditServiceDuration(item.duration);
    setEditServiceCategory(item.category || "General");
  };

  const cancelEditingService = () => {
    setEditingServiceId(null);
  };

  const saveEditingService = async (serviceId?: string) => {
    if (!editServiceName.trim() || !editServicePrice) return;

    const updatedServices = services.map((s) => {
      const isTarget = serviceId ? s.id === serviceId : (s.id === editingServiceId || s.name === editServiceName);
      if (isTarget) {
        return {
          ...s,
          name: editServiceName.trim(),
          price: parseFloat(editServicePrice) || 0,
          duration: editServiceDuration.trim() || "30 mins",
          category: editServiceCategory.trim() || "General",
        };
      }
      return s;
    });

    setServices(updatedServices);
    setEditingServiceId(null);

    try {
      await updateBusinessConfig({
        business_name: businessName,
        industry: activePreset,
        client_label: clientLabel,
        provider_label: providerLabel,
        services: updatedServices,
      });
      setToastMessage(`Updated "${editServiceName}" in catalog & synced with AI!`);
    } catch {
      setToastMessage(`Updated "${editServiceName}". Click "Save All Changes" to persist.`);
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteService = async (id?: string) => {
    const updated = services.filter((s) => s.id !== id);
    setServices(updated);
    if (editingServiceId === id) setEditingServiceId(null);
    try {
      await updateBusinessConfig({
        services: updated,
      });
      setToastMessage("Service removed from catalog and AI context.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch {}
  };

  // FAQ Management
  const handleAddFaq = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaqQ.trim() || !newFaqA.trim()) return;

    const newFaq: FaqItem = {
      id: `faq_${Date.now()}`,
      question: newFaqQ.trim(),
      answer: newFaqA.trim(),
    };

    setFaqs((prev) => [...prev, newFaq]);
    setNewFaqQ("");
    setNewFaqA("");
    setToastMessage("Added FAQ to knowledge base! Click 'Save All Changes' to sync.");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const startEditingFaq = (faq: FaqItem) => {
    setEditingFaqId(faq.id || faq.question);
    setEditFaqQuestion(faq.question);
    setEditFaqAnswer(faq.answer);
  };

  const cancelEditingFaq = () => {
    setEditingFaqId(null);
  };

  const saveEditingFaq = async (faqId?: string) => {
    if (!editFaqQuestion.trim() || !editFaqAnswer.trim()) return;

    const updatedFaqs = faqs.map((f) => {
      const isTarget = faqId ? f.id === faqId : (f.id === editingFaqId || f.question === editFaqQuestion);
      if (isTarget) {
        return {
          ...f,
          question: editFaqQuestion.trim(),
          answer: editFaqAnswer.trim(),
        };
      }
      return f;
    });

    setFaqs(updatedFaqs);
    setEditingFaqId(null);

    try {
      await updateBusinessConfig({
        faqs: updatedFaqs,
      });
      setToastMessage("FAQ updated and synced with AI receptionist!");
    } catch {
      setToastMessage("FAQ updated locally. Click 'Save All Changes' to persist.");
    }
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteFaq = async (id?: string) => {
    const updated = faqs.filter((f) => f.id !== id);
    setFaqs(updated);
    if (editingFaqId === id) setEditingFaqId(null);
    try {
      await updateBusinessConfig({
        faqs: updated,
      });
      setToastMessage("FAQ removed from knowledge base.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch {}
  };

  // Escalation Keyword Management
  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newKeyword.trim().toLowerCase();
    if (!clean) return;
    if (escalationRules.includes(clean)) {
      setNewKeyword("");
      return;
    }
    const updated = [...escalationRules, clean];
    setEscalationRules(updated);
    setNewKeyword("");
    setToastMessage(`Added "${clean}" to AI escalation rules.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleRemoveKeyword = (kw: string) => {
    const updated = escalationRules.filter((k) => k !== kw);
    setEscalationRules(updated);
    setToastMessage(`Removed "${kw}" from escalation rules.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const updateDayHour = (
    day: keyof OperatingHours,
    field: "is_closed" | "open" | "close",
    val: any
  ) => {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: val,
      },
    }));
  };

  const sectionTitles = {
    identity: "Identity & Terminology",
    hours: "Operating Hours",
    services: "Services & Pricing",
    faqs: "Knowledge & FAQs",
    escalations: "Escalation Rules",
  };

  return (
    <DashboardShell>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-zinc-900 bg-[#09090B] px-4 py-2.5 text-xs font-medium text-white shadow-xl animate-in fade-in duration-150">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="border-b border-[#E4E4E7] bg-white px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-zinc-900">{businessName}</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-500">Receptionist Engine</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-900 font-medium">{sectionTitles[activeSection]}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-[#09090B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving to Supabase..." : "Save All Changes"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-6 max-w-6xl space-y-6">
        {/* Navigation Tabs (5 Tabs) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E4E4E7] pb-3">
          {[
            { id: "identity", label: "Identity & Terminology", icon: Sliders },
            { id: "hours", label: "Operating Hours", icon: Clock },
            { id: "services", label: "Services & Pricing", icon: Tag },
            { id: "faqs", label: "Knowledge & FAQs", icon: BookOpen },
            { id: "escalations", label: "Escalation Rules", icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as any)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#09090B] text-white shadow-xs"
                    : "bg-white text-zinc-600 border border-[#E4E4E7] hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-zinc-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: IDENTITY & TERMINOLOGY + INDUSTRY PRESET SELECTOR */}
        {activeSection === "identity" && (
          <div className="space-y-6">
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
                  Select a template to configure terminology, catalog & tone
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {PRESET_TEMPLATES.map((preset) => {
                  const isSelected = activePreset === preset.key;
                  return (
                    <div
                      key={preset.key}
                      onClick={() => handleApplyPreset(preset.key)}
                      className={`relative flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition-all ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-50/70 ring-1 ring-zinc-900"
                          : "border-[#E4E4E7] bg-white hover:border-zinc-400 hover:bg-zinc-50/40"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-white">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                      )}
                      <div>
                        <div className="text-2xl mb-1.5">{preset.emoji}</div>
                        <h4 className="text-xs font-semibold text-[#09090B]">{preset.title}</h4>
                        <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                          {preset.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-200/60 text-[10px] space-y-0.5">
                        <div className="text-zinc-600">
                          Client: <span className="font-semibold text-zinc-900">{preset.clientLabel}</span>
                        </div>
                        <div className="text-zinc-600">
                          Provider: <span className="font-semibold text-zinc-900">{preset.providerLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Terminology & Voice Parameters */}
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-[#E4E4E7]">
                <Sliders className="h-4 w-4 text-zinc-900" />
                <h3 className="text-xs font-semibold text-[#09090B]">
                  Universal Terminology & Brand Voice
                </h3>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Business / Organization Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-zinc-400">Used in AI greeting & WhatsApp notifications</p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Client Term Label (e.g., Patient, Guest, Client, Car Owner)
                  </label>
                  <input
                    type="text"
                    value={clientLabel}
                    onChange={(e) => setClientLabel(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-zinc-400">Replaces all generic client references across platform</p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Provider Term Label (e.g., Doctor, Stylist, Advisor, Mechanic)
                  </label>
                  <input
                    type="text"
                    value={providerLabel}
                    onChange={(e) => setProviderLabel(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-zinc-400">Designates the service staff member taking the appointment</p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Currency Symbol
                  </label>
                  <div className="flex gap-2">
                    {["₹", "$", "€", "£", "AED"].map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => setCurrencySymbol(sym)}
                        className={`px-3 py-1 text-xs rounded-lg border cursor-pointer ${
                          currencySymbol === sym
                            ? "bg-[#09090B] text-white border-zinc-900"
                            : "bg-white text-zinc-700 border-[#E4E4E7] hover:bg-zinc-50"
                        }`}
                      >
                        {sym}
                      </button>
                    ))}
                    <input
                      type="text"
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      placeholder="Other"
                      className="w-16 rounded-lg border border-[#E4E4E7] px-2 py-1 text-xs text-center text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Conversational AI Tone & Persona
                  </label>
                  <input
                    type="text"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-zinc-400">Directly steers Groq LPU system prompt reasoning behavior</p>
                </div>
              </div>
            </div>

            {/* Broadcast Notice / Holiday Alert */}
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-zinc-900" />
                  <h3 className="text-xs font-semibold text-[#09090B]">
                    Top Broadcast Notice & Emergency Closure
                  </h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[11px] text-zinc-600 font-medium">
                    {broadcastNotice.is_active ? "Banner Active" : "Banner Disabled"}
                  </span>
                  <input
                    type="checkbox"
                    checked={broadcastNotice.is_active}
                    onChange={(e) =>
                      setBroadcastNotice((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                    className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Announcement / Closure Message
                  </label>
                  <input
                    type="text"
                    value={broadcastNotice.notice_text}
                    onChange={(e) =>
                      setBroadcastNotice((prev) => ({ ...prev, notice_text: e.target.value }))
                    }
                    placeholder="e.g., Closed tomorrow for annual team inventory. Reopening Monday."
                    className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[10px] text-zinc-400">
                    Displayed on the dashboard header banner and proactively stated by WhatsApp AI
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Effective Period / Dates
                  </label>
                  <input
                    type="text"
                    value={broadcastNotice.effective_dates || ""}
                    onChange={(e) =>
                      setBroadcastNotice((prev) => ({ ...prev, effective_dates: e.target.value }))
                    }
                    placeholder="e.g., Oct 26 - Oct 27"
                    className="w-full rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OPERATING HOURS */}
        {activeSection === "hours" && (
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
              <div>
                <h3 className="text-xs font-semibold text-[#09090B]">
                  Weekly Working Hours Matrix
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Slots outside these hours are automatically protected and rejected by the AI receptionist.
                </p>
              </div>
            </div>

            <div className="mt-4 divide-y divide-[#E4E4E7]">
              {DAYS_OF_WEEK.map(({ key, label }) => {
                const dayState = hours[key as keyof OperatingHours];
                if (!dayState) return null;

                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2"
                  >
                    <div className="flex items-center gap-3 w-32">
                      <input
                        type="checkbox"
                        id={`check-${key}`}
                        checked={!dayState.is_closed}
                        onChange={(e) =>
                          updateDayHour(key as keyof OperatingHours, "is_closed", !e.target.checked)
                        }
                        className="h-4 w-4 rounded-sm border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                      />
                      <label
                        htmlFor={`check-${key}`}
                        className={`text-xs font-medium cursor-pointer ${
                          dayState.is_closed ? "text-zinc-400 line-through" : "text-zinc-900"
                        }`}
                      >
                        {label}
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      {dayState.is_closed ? (
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500 border border-zinc-200">
                          Closed / Off-Day
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={dayState.open}
                            onChange={(e) =>
                              updateDayHour(key as keyof OperatingHours, "open", e.target.value)
                            }
                            className="rounded-lg border border-[#E4E4E7] px-2.5 py-1 text-xs text-zinc-800 focus:border-zinc-900 focus:outline-hidden"
                          />
                          <span className="text-zinc-400 text-xs">to</span>
                          <input
                            type="time"
                            value={dayState.close}
                            onChange={(e) =>
                              updateDayHour(key as keyof OperatingHours, "close", e.target.value)
                            }
                            className="rounded-lg border border-[#E4E4E7] px-2.5 py-1 text-xs text-zinc-800 focus:border-zinc-900 focus:outline-hidden"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: SERVICES & PRICING */}
        {activeSection === "services" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
                <div>
                  <h3 className="text-xs font-semibold text-[#09090B]">
                    Active Services Catalog ({services.length})
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    AI quotes these exact prices ({currencySymbol}) and durations when conversing with leads.
                  </p>
                </div>
              </div>

              {/* Add New Service Form */}
              <form
                onSubmit={handleAddService}
                className="mt-4 p-3.5 bg-zinc-50 rounded-xl border border-[#E4E4E7] grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
              >
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Service Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Consultation, Haircut, Audit"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Price ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    placeholder="500"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    placeholder="30 mins"
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-[#09090B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Service</span>
                </button>
              </form>

              {/* Service List Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E4E4E7] text-[11px] text-zinc-500 uppercase bg-zinc-50/50">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Service Name</th>
                      <th className="py-2.5 px-3 font-semibold">Category</th>
                      <th className="py-2.5 px-3 font-semibold">Duration</th>
                      <th className="py-2.5 px-3 font-semibold">Price ({currencySymbol})</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {services.map((item) => {
                      const isEditing = editingServiceId === (item.id || item.name);
                      return (
                        <tr key={item.id || item.name} className="hover:bg-zinc-50/60">
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editServiceName}
                                onChange={(e) => setEditServiceName(e.target.value)}
                                className="w-full rounded-md border border-zinc-900 px-2 py-1 text-xs text-zinc-900 focus:outline-hidden"
                              />
                            ) : (
                              <span className="font-medium text-zinc-900">{item.name}</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editServiceCategory}
                                onChange={(e) => setEditServiceCategory(e.target.value)}
                                className="w-full rounded-md border border-zinc-900 px-2 py-1 text-xs text-zinc-900 focus:outline-hidden"
                              />
                            ) : (
                              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                                {item.category || "General"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-zinc-600">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editServiceDuration}
                                onChange={(e) => setEditServiceDuration(e.target.value)}
                                className="w-24 rounded-md border border-zinc-900 px-2 py-1 text-xs text-zinc-900 focus:outline-hidden"
                              />
                            ) : (
                              item.duration
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold text-zinc-900">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <span className="text-zinc-500">{currencySymbol}</span>
                                <input
                                  type="number"
                                  value={editServicePrice}
                                  onChange={(e) => setEditServicePrice(e.target.value)}
                                  className="w-24 rounded-md border border-zinc-900 px-2 py-1 text-xs text-zinc-900 focus:outline-hidden"
                                />
                              </div>
                            ) : (
                              `${currencySymbol}${item.price}`
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => saveEditingService(item.id)}
                                  className="p-1 rounded-md text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                  title="Save edit"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEditingService}
                                  className="p-1 rounded-md text-zinc-500 hover:bg-zinc-100 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => startEditingService(item)}
                                  className="p-1 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
                                  title="Edit service"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteService(item.id)}
                                  className="p-1 rounded-md text-zinc-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                  title="Delete service"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: KNOWLEDGE & FAQS */}
        {activeSection === "faqs" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
                <div>
                  <h3 className="text-xs font-semibold text-[#09090B]">
                    Knowledge Base & Frequently Asked Questions ({faqs.length})
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Groq LLM uses these factual answers for directions, payments, policies, and parking inquiries.
                  </p>
                </div>
              </div>

              {/* Add FAQ Form */}
              <form onSubmit={handleAddFaq} className="mt-4 p-4 bg-zinc-50 rounded-xl border border-[#E4E4E7] space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Question
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. What are your parking facilities or insurance tie-ups?"
                    value={newFaqQ}
                    onChange={(e) => setNewFaqQ(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Answer / Business Policy
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide a clear, accurate answer for the AI receptionist to explain to users."
                    value={newFaqA}
                    onChange={(e) => setNewFaqA(e.target.value)}
                    className="w-full rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg bg-[#09090B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Q&A to Knowledge Base</span>
                  </button>
                </div>
              </form>

              {/* FAQ List */}
              <div className="mt-4 space-y-3">
                {faqs.map((faq) => {
                  const isEditing = editingFaqId === (faq.id || faq.question);
                  return (
                    <div
                      key={faq.id || faq.question}
                      className="rounded-xl border border-[#E4E4E7] p-4 bg-white hover:border-zinc-300 transition-colors"
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editFaqQuestion}
                            onChange={(e) => setEditFaqQuestion(e.target.value)}
                            className="w-full rounded-lg border border-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-900 focus:outline-hidden"
                          />
                          <textarea
                            rows={3}
                            value={editFaqAnswer}
                            onChange={(e) => setEditFaqAnswer(e.target.value)}
                            className="w-full rounded-lg border border-zinc-900 px-3 py-1.5 text-xs text-zinc-800 focus:outline-hidden"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={cancelEditingFaq}
                              className="px-3 py-1 text-xs rounded-lg border border-[#E4E4E7] text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEditingFaq(faq.id)}
                              className="px-3 py-1 text-xs rounded-lg bg-[#09090B] text-white hover:bg-zinc-800 font-semibold cursor-pointer"
                            >
                              Save Answer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-[#09090B] flex items-center gap-1.5">
                              <HelpCircle className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                              <span>{faq.question}</span>
                            </h4>
                            <p className="text-xs text-zinc-600 pl-5 leading-relaxed">{faq.answer}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEditingFaq(faq)}
                              className="p-1 text-zinc-400 hover:text-zinc-900 rounded-md hover:bg-zinc-50 cursor-pointer"
                              title="Edit FAQ"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFaq(faq.id)}
                              className="p-1 text-zinc-400 hover:text-rose-600 rounded-md hover:bg-rose-50 cursor-pointer"
                              title="Delete FAQ"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ESCALATION RULES */}
        {activeSection === "escalations" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-zinc-900" />
                  <div>
                    <h3 className="text-xs font-semibold text-[#09090B]">
                      Autonomous AI Escalation & Safety Triggers
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      When a lead sends a message containing any of these keywords, the AI immediately pauses autonomous replies, flags the thread as Escalated in Live Inbox, and prompts staff to take over.
                    </p>
                  </div>
                </div>
              </div>

              {/* Add Keyword Form */}
              <form onSubmit={handleAddKeyword} className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Enter keyword trigger (e.g. bleeding, dispute, refund, emergency)"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="max-w-md flex-1 rounded-lg border border-[#E4E4E7] px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-[#09090B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Trigger Word</span>
                </button>
              </form>

              {/* Keywords Tag Grid */}
              <div className="mt-5">
                <div className="text-[11px] font-medium text-zinc-500 mb-2">
                  Active Escalation Trigger Keywords ({escalationRules.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {escalationRules.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800"
                    >
                      <span className="font-mono text-[11px]">{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(kw)}
                        className="rounded-full text-zinc-400 hover:text-rose-600 hover:bg-zinc-200/60 p-0.5 cursor-pointer"
                        title={`Remove "${kw}"`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                  <span>Autonomous Safety Guarantee</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-800 leading-relaxed">
                  The Groq AI engine runs an exact regex and semantic scan against this list on every incoming WhatsApp webhook message before running tool execution. If triggered, the tool <code>escalate_to_human</code> runs immediately and WhatsApp sends a calming acknowledgement that a staff member will respond promptly.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
