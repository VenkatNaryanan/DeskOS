"use client";

import React, { useState, useEffect } from "react";
import DashboardShell from "@/components/DashboardShell";
import NewBookingModal from "@/components/NewBookingModal";
import {
  Calendar,
  Clock,
  Search,
  Plus,
  Send,
  CheckCircle2,
  ChevronRight,
  Filter,
  User,
  Phone,
  Tag,
  ArrowUpRight,
  XCircle,
  RefreshCw
} from "lucide-react";
import {
  Booking,
  BusinessConfig,
  fetchBookings,
  fetchBusinessConfig,
  sendManualOperatorMessage,
  cancelBooking,
  rescheduleBooking
} from "@/lib/api";

export default function AppointmentsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [config, setConfig] = useState<BusinessConfig | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "confirmed" | "progress" | "completed" | "cancelled">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clientLabel = config?.client_label || "Client";
  const providerLabel = config?.provider_label || "Provider";
  const businessName = config?.business_name || "DeskOS Studio";

  const loadData = async () => {
    try {
      setLoading(true);
      const [bks, cfg] = await Promise.all([
        fetchBookings().catch(() => []),
        fetchBusinessConfig().catch(() => null),
      ]);

      if (cfg) setConfig(cfg);
      setBookings(bks || []);
    } catch (err) {
      console.error("Failed to load appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendReminder = async (booking: Booking) => {
    if (!booking.phone) return;
    try {
      await sendManualOperatorMessage(
        booking.conversation_id || "direct_sms",
        booking.phone,
        `🔔 Hi ${booking.client_name || booking.patient_name || clientLabel}, this is a reminder for your upcoming appointment for ${booking.service || "your session"} at ${booking.slot_time} with ${businessName}.`
      );
      setToastMessage(`WhatsApp reminder dispatched to ${booking.phone}!`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      setToastMessage(`Failed to send reminder.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment? This will release the slot.")) return;
    try {
      await cancelBooking(bookingId, "Cancelled via dashboard");
      setToastMessage("Appointment cancelled and slot released.");
      setTimeout(() => setToastMessage(null), 3000);
      loadData();
    } catch (err) {
      alert("Failed to cancel appointment");
    }
  };

  const handleReschedule = async (booking: Booking) => {
    const newTime = prompt(`Enter new date and time for ${booking.client_name || booking.patient_name}:`, booking.slot_time);
    if (!newTime || newTime.trim() === booking.slot_time) return;
    try {
      await rescheduleBooking(booking.id, newTime.trim());
      setToastMessage(`Appointment rescheduled to ${newTime}!`);
      setTimeout(() => setToastMessage(null), 3000);
      loadData();
    } catch (err: any) {
      alert(err.message || "Slot conflict or invalid time.");
    }
  };

  const filtered = bookings.filter((b) => {
    const name = (b.client_name || b.patient_name || "").toLowerCase();
    const phone = (b.phone || "").toLowerCase();
    const srv = (b.service || b.service_type || "").toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch = name.includes(q) || phone.includes(q) || srv.includes(q);
    if (!matchesSearch) return false;

    if (filter === "all") return true;
    if (filter === "confirmed") return b.status?.toLowerCase() === "confirmed";
    if (filter === "progress") return b.status?.toLowerCase().includes("progress");
    if (filter === "completed") return b.status?.toLowerCase().includes("completed");
    if (filter === "cancelled") return b.status?.toLowerCase().includes("cancelled");
    return true;
  });

  return (
    <DashboardShell>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Breadcrumb */}
      <div className="border-b border-[#E4E4E7] bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-zinc-900">{businessName}</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-zinc-500">Reception</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-zinc-900 font-medium">Appointments Register</span>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#09090B] px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Appointment</span>
        </button>
      </div>

      <div className="p-6 space-y-6 max-w-7xl">
        {/* Controls Bar: Search & Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder={`Search by ${clientLabel.toLowerCase()} name, phone, or service...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E4E4E7] bg-white py-2 pl-9 pr-3 text-xs placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { id: "all", label: "All Bookings" },
              { id: "confirmed", label: "Confirmed" },
              { id: "progress", label: "In Progress" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  filter === f.id
                    ? "bg-[#09090B] text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Appointments Table */}
        <div className="rounded-xl border border-[#E4E4E7] bg-white shadow-xs overflow-hidden">
          <div className="p-5 border-b border-[#E4E4E7] flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-[#09090B]">
                {clientLabel} Booking Register
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Automatically synced with WhatsApp conversational reservations
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
              {filtered.length} Bookings
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-zinc-50/70 text-[11px] font-semibold text-zinc-500">
                  <th className="py-3 px-4">{clientLabel} Name</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Slot Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {filtered.map((b) => {
                  const targetName = b.client_name || b.patient_name || `${clientLabel} Guest`;
                  const isCancelled = b.status?.toLowerCase() === "cancelled";
                  return (
                    <tr key={b.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-zinc-900">
                        {targetName}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-600">
                        {b.phone}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-700">
                        {b.service || b.service_type || "Appointment"}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-zinc-800">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Clock className="h-3 w-3 text-zinc-400" />
                          {b.slot_time}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isCancelled
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : b.status?.toLowerCase().includes("progress")
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : b.status?.toLowerCase().includes("completed")
                              ? "bg-zinc-100 text-zinc-600"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {b.status || "Confirmed"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isCancelled && (
                            <>
                              <button
                                onClick={() => handleSendReminder(b)}
                                title="Send WhatsApp reminder"
                                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
                              >
                                <Send className="h-3 w-3" />
                                <span>Remind</span>
                              </button>
                              <button
                                onClick={() => handleReschedule(b)}
                                title="Reschedule slot"
                                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
                              >
                                <RefreshCw className="h-3 w-3" />
                                <span>Reschedule</span>
                              </button>
                              <button
                                onClick={() => handleCancel(b.id)}
                                title="Cancel and release slot"
                                className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <XCircle className="h-3 w-3" />
                                <span>Cancel</span>
                              </button>
                            </>
                          )}
                          {isCancelled && (
                            <span className="text-[11px] text-zinc-400 italic">Slot Released</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-zinc-400">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                      <p className="text-xs font-medium text-zinc-600">No appointments found</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Create an appointment manually or let your AI receptionist book it via WhatsApp.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Booking Modal */}
      {isModalOpen && (
        <NewBookingModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onBookingCreated={() => {
            setIsModalOpen(false);
            setToastMessage("Appointment booked successfully with zero overlap!");
            setTimeout(() => setToastMessage(null), 3000);
            loadData();
          }}
          clientLabel={clientLabel}
          servicesList={config?.services || []}
        />
      )}
    </DashboardShell>
  );
}
