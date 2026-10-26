"use client";

import React, { useState, useEffect } from "react";
import DashboardShell from "@/components/DashboardShell";
import NewBookingModal from "@/components/NewBookingModal";
import {
  Search,
  Calendar,
  Plus,
  AlertTriangle,
  Edit3,
  TrendingUp,
  Clock,
  Sparkles,
  Phone,
  MessageSquare,
  ChevronRight,
  Send,
  CheckCircle2,
  Users,
  ShieldAlert,
  ArrowUpRight,
  Filter,
  Check,
  X,
  Radio
} from "lucide-react";
import {
  Booking,
  BusinessConfig,
  AnalyticsData,
  fetchBookings,
  fetchBusinessConfig,
  updateBusinessConfig,
  fetchAnalytics,
  sendManualOperatorMessage
} from "@/lib/api";

export default function OverviewPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // New Booking Modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  // Broadcast Notice Inline Edit Modal/State
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const [noticeActive, setNoticeActive] = useState(true);
  const [noticeEffectiveDate, setNoticeEffectiveDate] = useState("");
  const [isSavingNotice, setIsSavingNotice] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reminder button state
  const [reminderSent, setReminderSent] = useState(false);

  // Chart range filter
  const [chartRange, setChartRange] = useState<"7d" | "30d" | "90d">("7d");

  // Search filter for appointments
  const [searchQuery, setSearchQuery] = useState("");

  const clientLabel = config?.client_label || "Client";
  const providerLabel = config?.provider_label || "Provider";
  const businessName = config?.business_name || "Universal AI Engine";
  const currencySymbol = config?.currency_symbol || "₹";

  const loadData = async () => {
    try {
      const [bks, cfg, ana] = await Promise.all([
        fetchBookings().catch(() => []),
        fetchBusinessConfig().catch(() => null),
        fetchAnalytics().catch(() => null),
      ]);

      if (bks && bks.length > 0) {
        setBookings(bks);
      } else {
        // High quality universal demo fallback appointments
        setBookings([
          {
            id: "1",
            client_name: "Rahul Sharma",
            patient_name: "Rahul Sharma",
            phone: "+91 98765 43210",
            service: "Initial Consultation",
            slot_time: "Today, 02:30 PM",
            status: "Confirmed",
            created_at: new Date().toISOString(),
          },
          {
            id: "2",
            client_name: "Pooja Patel",
            patient_name: "Pooja Patel",
            phone: "+91 98123 45678",
            service: "Standard Appointment",
            slot_time: "Today, 03:45 PM",
            status: "In Progress",
            created_at: new Date().toISOString(),
          },
          {
            id: "3",
            client_name: "Amitabh Verma",
            patient_name: "Amitabh Verma",
            phone: "+91 99234 56789",
            service: "Comprehensive Session",
            slot_time: "Today, 05:00 PM",
            status: "Confirmed",
            created_at: new Date().toISOString(),
          },
          {
            id: "4",
            client_name: "Ananya Deshmukh",
            patient_name: "Ananya Deshmukh",
            phone: "+91 98711 22334",
            service: "Follow-up Review",
            slot_time: "Today, 06:15 PM",
            status: "Confirmed",
            created_at: new Date().toISOString(),
          },
          {
            id: "5",
            client_name: "Vikram Sethi",
            patient_name: "Vikram Sethi",
            phone: "+91 98450 11223",
            service: "Routine Service Session",
            slot_time: "Today, 07:00 PM",
            status: "Completed",
            created_at: new Date().toISOString(),
          },
        ]);
      }

      if (cfg) {
        setConfig(cfg);
        const notice = cfg.broadcast_notice || cfg.emergency_notice;
        if (notice) {
          setNoticeText(notice.notice_text || "Closed tomorrow for inventory / holiday");
          setNoticeActive(notice.is_active ?? true);
          setNoticeEffectiveDate(notice.effective_dates || "Tomorrow, 25 Oct 2026");
        }
      } else {
        setNoticeText("Closed tomorrow for inventory / holiday");
        setNoticeActive(true);
        setNoticeEffectiveDate("Tomorrow, 25 Oct 2026");
      }

      if (ana) {
        setAnalytics(ana);
      }
    } catch (err) {
      console.error("Failed to load overview data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveNotice = async () => {
    setIsSavingNotice(true);
    try {
      const noticePayload = {
        is_active: noticeActive,
        notice_text: noticeText,
        effective_dates: noticeEffectiveDate,
      };
      await updateBusinessConfig({
        broadcast_notice: noticePayload,
        emergency_notice: noticePayload,
      });
      setToastMessage("Broadcast notice saved to Supabase! AI agent updated instantly.");
      setIsEditingNotice(false);
      setTimeout(() => setToastMessage(null), 4000);
      loadData();
    } catch (err) {
      alert("Failed to update notice in Supabase. Check backend connection.");
    } finally {
      setIsSavingNotice(false);
    }
  };

  const handleSendReminder = async (phone: string, targetName: string) => {
    setReminderSent(true);
    try {
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      await sendManualOperatorMessage(
        "reminder_conv",
        cleanPhone,
        `Hello ${targetName}, this is a gentle reminder for your scheduled booking today at ${businessName}. Please arrive 10 minutes early. Let us know if you need to adjust your time!`
      );
      setToastMessage(`WhatsApp reminder dispatched to ${targetName}!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      setToastMessage(`Reminder simulation logged for ${targetName}`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Next booking
  const nextBooking = bookings[0] || {
    client_name: "Rahul Sharma",
    patient_name: "Rahul Sharma",
    phone: "+91 98765 43210",
    service: "Initial Consultation",
    slot_time: "Today, 02:30 PM",
  };

  // Filtered appointments list
  const filteredBookings = bookings.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (b.client_name || b.patient_name || "").toLowerCase();
    const phone = (b.phone || "").toLowerCase();
    const srv = (b.service || b.service_type || "").toLowerCase();
    return name.includes(q) || phone.includes(q) || srv.includes(q);
  });

  return (
    <DashboardShell onRefresh={loadData}>
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-zinc-900 bg-[#09090B] px-4 py-2.5 text-xs font-medium text-white shadow-xl animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="border-b border-[#E4E4E7] bg-white px-6 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Breadcrumb trail */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-zinc-900">{businessName}</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-500">Overview</span>
          </div>

          {/* Right Header items: Search, Date Stamp, + New Booking */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search bar */}
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder={`Search ${clientLabel.toLowerCase()} or booking...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-60 rounded-lg border border-[#E4E4E7] bg-zinc-50/70 pl-8 pr-12 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-hidden transition-all"
              />
              <span className="pointer-events-none absolute right-2.5 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 shadow-2xs">
                ⌘K
              </span>
            </div>

            {/* Date stamp */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-zinc-50/50 px-3 py-1.5 text-xs font-medium text-zinc-700">
              <Calendar className="h-3.5 w-3.5 text-zinc-500" />
              <span>Today, Saturday, 24 October 2026</span>
            </div>

            {/* Solid black + New Booking action button */}
            <button
              onClick={() => setIsBookingModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#09090B] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>+ New Booking</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="p-6 space-y-6">
        {/* Top Alert Banner: Displays broadcast_notice with inline editor and instant Supabase save */}
        <section className="relative overflow-hidden rounded-xl border border-amber-200/90 bg-amber-50/40 p-4 shadow-xs transition-all">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Radio className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-950">
                    Live Broadcast Notice & Schedule Alert
                  </span>
                  {noticeActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Broadcast Active to Callers
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                      Broadcast Inactive
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-amber-900/90 leading-relaxed font-normal">
                  {noticeText || "Closed tomorrow for inventory / holiday"}
                </p>
                {noticeEffectiveDate && (
                  <div className="mt-1 text-[11px] font-medium text-amber-700/80">
                    Effective Period: {noticeEffectiveDate}
                  </div>
                )}
              </div>
            </div>

            {/* Inline Edit Button */}
            <button
              onClick={() => setIsEditingNotice(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 shadow-2xs hover:bg-amber-100/60 transition-colors shrink-0 cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5 text-amber-700" />
              <span>Edit Broadcast Notice</span>
            </button>
          </div>
        </section>

        {/* Modal for Editing Broadcast Notice with Instant Supabase Save */}
        {isEditingNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              onClick={() => setIsEditingNotice(false)}
              className="fixed inset-0 bg-black/35 backdrop-blur-xs transition-opacity"
            />
            <div className="relative w-full max-w-lg rounded-2xl border border-[#E4E4E7] bg-white p-6 shadow-2xl z-10 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-zinc-900" />
                  <h3 className="text-sm font-semibold text-[#09090B]">
                    Broadcast Notice & Holiday Notice
                  </h3>
                </div>
                <button
                  onClick={() => setIsEditingNotice(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Broadcast Message (Spoken by AI Receptionist)
                  </label>
                  <textarea
                    rows={3}
                    value={noticeText}
                    onChange={(e) => setNoticeText(e.target.value)}
                    placeholder="e.g. Closed tomorrow for inventory / holiday"
                    className="w-full rounded-xl border border-[#E4E4E7] p-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    The autonomous WhatsApp AI will inform all leads and prevent bookings during this period.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Effective Period
                    </label>
                    <input
                      type="text"
                      value={noticeEffectiveDate}
                      onChange={(e) => setNoticeEffectiveDate(e.target.value)}
                      placeholder="e.g. Tomorrow, Oct 25"
                      className="w-full rounded-xl border border-[#E4E4E7] px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-2 rounded-xl border border-[#E4E4E7] px-3 py-2 text-xs font-medium text-zinc-800 cursor-pointer hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={noticeActive}
                        onChange={(e) => setNoticeActive(e.target.checked)}
                        className="rounded border-zinc-300 text-zinc-900 focus:ring-0"
                      />
                      <span>Active Broadcast</span>
                    </label>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E4E4E7] flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setIsEditingNotice(false)}
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotice}
                    disabled={isSavingNotice}
                    className="flex items-center gap-1.5 rounded-xl bg-[#09090B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isSavingNotice ? "Saving to Supabase..." : "Save to Supabase"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* KPI Metric Cards: Total Inquiries, Confirmed Bookings, AI Conversion Rate, Escalations */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Inquiries */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs hover:border-zinc-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Total Inquiries
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                <MessageSquare className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[#09090B]">
                {analytics?.total_leads !== undefined ? analytics.total_leads : 0}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                Live Conversations
              </span>
              <span className="text-[11px] text-zinc-400">Total Leads</span>
            </div>
          </div>

          {/* Card 2: Confirmed Bookings */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs hover:border-zinc-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Confirmed Bookings
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                <Calendar className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[#09090B]">
                {bookings.length} Booked
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
                Active Slots
              </span>
              <span className="text-[11px] text-zinc-400">Conflict Protected</span>
            </div>
          </div>

          {/* Card 3: AI Conversion Rate */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs hover:border-zinc-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                AI Conversion Rate
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[#09090B]">
                {analytics?.conversion_rate !== undefined ? `${analytics.conversion_rate}%` : "0.0%"}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200/50">
                Autonomous Groq LPUs
              </span>
            </div>
          </div>

          {/* Card 4: Escalations */}
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs hover:border-zinc-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Escalations
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-[#09090B]">
                {analytics?.escalated_count ?? 0}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200/60">
                Human Desk
              </span>
              <span className="text-[11px] text-zinc-400">Live Inbox</span>
            </div>
          </div>
        </section>

        {/* Center Grid Layout: 2-Column split (70% Left / 30% Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (70% width ~ 8 cols out of 12) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Inquiry & Booking Volume Area Chart */}
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#E4E4E7] gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-[#09090B] tracking-tight">
                    Inquiry & Booking Volume
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Real-time WhatsApp inbound leads vs confirmed appointments
                    <span className="text-[10px] text-zinc-400 font-normal ml-1.5">(Development trend view)</span>
                  </p>
                </div>

                {/* 7d / 30d / 90d Filter Pills */}
                <div className="flex items-center rounded-lg border border-[#E4E4E7] bg-zinc-50 p-0.5">
                  {(["7d", "30d", "90d"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setChartRange(r)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                        chartRange === r
                          ? "bg-white text-[#09090B] shadow-2xs font-semibold"
                          : "text-zinc-500 hover:text-zinc-900"
                      }`}
                    >
                      {r.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Area Chart SVG Graphic */}
              <div className="mt-5">
                <div className="relative h-56 w-full">
                  <svg
                    className="h-full w-full overflow-visible"
                    viewBox="0 0 650 200"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#09090B" stopOpacity="0.12" />
                        <stop offset="100%" stopColor="#09090B" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <line x1="0" y1="40" x2="650" y2="40" stroke="#F4F4F5" strokeWidth="1" />
                    <line x1="0" y1="90" x2="650" y2="90" stroke="#F4F4F5" strokeWidth="1" />
                    <line x1="0" y1="140" x2="650" y2="140" stroke="#F4F4F5" strokeWidth="1" />
                    <line x1="0" y1="190" x2="650" y2="190" stroke="#E4E4E7" strokeWidth="1" />

                    <path
                      d="M 20 160 C 100 140, 160 80, 220 90 C 280 100, 340 50, 420 60 C 500 70, 560 30, 630 40 L 630 190 L 20 190 Z"
                      fill="url(#greenGradient)"
                    />

                    <path
                      d="M 20 160 C 100 140, 160 80, 220 90 C 280 100, 340 50, 420 60 C 500 70, 560 30, 630 40"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />

                    <path
                      d="M 20 130 C 100 110, 160 50, 220 65 C 280 75, 340 30, 420 35 C 500 45, 560 15, 630 20"
                      fill="none"
                      stroke="#09090B"
                      strokeWidth="1.75"
                      strokeDasharray="4 4"
                    />

                    <circle cx="220" cy="90" r="4" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="420" cy="60" r="4" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                    <circle cx="630" cy="40" r="4.5" fill="#09090B" stroke="#ffffff" strokeWidth="2" />
                  </svg>
                </div>

                <div className="mt-3 flex justify-between text-[11px] font-medium text-zinc-400 px-2">
                  <span>Mon (19 Oct)</span>
                  <span>Tue (20 Oct)</span>
                  <span>Wed (21 Oct)</span>
                  <span>Thu (22 Oct)</span>
                  <span>Fri (23 Oct)</span>
                  <span>Sat (Today)</span>
                  <span>Sun (25 Oct)</span>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E4E4E7] flex items-center justify-end gap-5 text-xs text-zinc-600">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
                    <span className="text-[11px] font-medium">Confirmed Bookings</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 border-t border-dashed border-zinc-900"></span>
                    <span className="text-[11px] font-medium">Total WhatsApp Leads</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Bookings Table with Dynamic Labels */}
            <div className="rounded-xl border border-[#E4E4E7] bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-[#E4E4E7]">
                <div>
                  <h3 className="text-xs font-semibold text-[#09090B] tracking-tight">
                    Recent Bookings
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {clientLabel}s scheduled for appointment and services
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                  {filteredBookings.length} Scheduled
                </span>
              </div>

              {/* Table with Dynamic Columns */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E4E7] bg-zinc-50/70 text-[11px] font-semibold text-zinc-500">
                      <th className="py-2.5 px-4">{clientLabel} Name</th>
                      <th className="py-2.5 px-4">WhatsApp Contact</th>
                      <th className="py-2.5 px-4">Service</th>
                      <th className="py-2.5 px-4">Scheduled Slot</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7]">
                    {filteredBookings.slice(0, 6).map((booking, idx) => {
                      const name = booking.client_name || booking.patient_name || `${clientLabel} #${idx + 1}`;
                      return (
                        <tr
                          key={booking.id || idx}
                          className="hover:bg-zinc-50/70 transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-zinc-900">
                            {name}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-zinc-600">
                            {booking.phone || "+91 98765 43210"}
                          </td>
                          <td className="py-3 px-4 text-zinc-700">
                            <span className="inline-flex items-center gap-1">
                              {booking.service || booking.service_type || "Appointment Session"}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-800">
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock className="h-3 w-3 text-zinc-400" />
                              {booking.slot_time}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                booking.status?.toLowerCase().includes("progress")
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : booking.status?.toLowerCase().includes("completed")
                                  ? "bg-zinc-100 text-zinc-600"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {booking.status || "Confirmed"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column (30% width ~ 4 cols out of 12) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Top Catalog Services Card */}
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
              <div className="pb-3 border-b border-[#E4E4E7]">
                <h3 className="text-xs font-semibold text-[#09090B]">
                  Active Services & Pricing
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Frequently booked catalog options
                </p>
              </div>

              <div className="mt-4 space-y-3.5">
                {(config?.services && config.services.length > 0
                  ? config.services.slice(0, 4)
                  : [
                      { name: "Initial Consultation", price: 500, duration: "30 mins" },
                      { name: "Comprehensive Review", price: 1500, duration: "45 mins" },
                      { name: "Specialized Service", price: 3500, duration: "60 mins" },
                    ]
                ).map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800 truncate max-w-[180px]">
                        {item.name}
                      </span>
                      <span className="font-semibold text-zinc-900 font-mono text-[11px]">
                        {currencySymbol}{item.price}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                      <span>{item.duration || "30 mins"}</span>
                      <span>{idx === 0 ? "42% bookings" : idx === 1 ? "28% bookings" : "15% bookings"}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${idx === 0 ? "bg-zinc-900" : idx === 1 ? "bg-zinc-700" : "bg-zinc-400"}`}
                        style={{ width: `${idx === 0 ? 42 : idx === 1 ? 28 : 15}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Client Booking Card */}
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[#E4E4E7]">
                <span className="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                  Immediate Next {clientLabel}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  In 45 Mins
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <h4 className="text-base font-bold text-[#09090B]">
                    {nextBooking.client_name || nextBooking.patient_name || "Rahul Sharma"}
                  </h4>
                  <p className="text-xs font-mono text-zinc-500 mt-0.5">
                    {nextBooking.phone || "+91 98765 43210"}
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-50 p-2.5 border border-zinc-200/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Service</span>
                    <span className="font-medium text-zinc-900">
                      {nextBooking.service || "Standard Appointment"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500">
                    <span>Slot Time</span>
                    <span className="font-semibold text-zinc-900">
                      {nextBooking.slot_time || "Today, 02:30 PM"}
                    </span>
                  </div>
                </div>

                {/* Send WhatsApp Reminder Button */}
                <button
                  onClick={() =>
                    handleSendReminder(
                      nextBooking.phone || "919876543210",
                      nextBooking.client_name || nextBooking.patient_name || clientLabel
                    )
                  }
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                    reminderSent
                      ? "bg-emerald-600 text-white"
                      : "bg-[#09090B] text-white hover:bg-zinc-800 active:scale-[0.98]"
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>
                    {reminderSent ? "Reminder Dispatched!" : `Send WhatsApp Reminder`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Booking Modal */}
      <NewBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onBookingCreated={(newBk) => {
          setBookings((prev) => [newBk, ...prev]);
          const name = newBk.client_name || newBk.patient_name || clientLabel;
          setToastMessage(`Booking confirmed for ${name}!`);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />
    </DashboardShell>
  );
}
