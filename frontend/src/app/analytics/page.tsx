"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import {
  TrendingUp,
  BarChart3,
  Calendar,
  Sparkles,
  Users,
  ChevronRight,
  ShieldAlert,
  Clock,
  Inbox
} from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8000/api/business/analytics")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load analytics:", err);
        setLoading(false);
      });
  }, []);

  const businessName = data?.business_name || "Apex Universal Studio";
  const currencySymbol = data?.currency || "₹";

  return (
    <div className="flex h-screen bg-[#FBFBFA] text-[#09090B]">
      {/* Universal Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="border-b border-[#E4E4E7] bg-white px-6 py-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-zinc-900">{businessName}</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-500">System</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-zinc-900 font-medium">Performance & Analytics</span>
          </div>
        </header>

        {/* Main Content */}
        <div className="p-6 space-y-6 max-w-7xl">
          {/* Header Title */}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">
              Operational Analytics & Insights
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Real-time operational performance calculated strictly from live database records.
            </p>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Total WhatsApp Inquiries</span>
              <div className="mt-2 text-2xl font-bold text-zinc-900">
                {data?.total_leads !== undefined ? data.total_leads : "0"}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                <span>Unique customer conversations</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Confirmed Bookings</span>
              <div className="mt-2 text-2xl font-bold text-zinc-900">
                {data?.booked_count !== undefined ? data.booked_count : "0"}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                <span>Active appointment slots</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">AI Conversion Rate</span>
              <div className="mt-2 text-2xl font-bold text-zinc-900">
                {data?.conversion_rate !== undefined ? `${data.conversion_rate}%` : "0.0%"}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                <TrendingUp className="h-3 w-3" />
                <span>Bookings per unique conversation</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#E4E4E7] bg-white p-4 shadow-xs">
              <span className="text-xs font-medium text-zinc-500">Human Escalations</span>
              <div className="mt-2 text-2xl font-bold text-zinc-900">
                {data?.escalated_count !== undefined ? data.escalated_count : "0"}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-zinc-500">
                <span>Transferred to human desk</span>
              </div>
            </div>
          </div>

          {/* Funnel & Service Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
              <h3 className="text-xs font-semibold text-[#09090B] mb-1">
                Lead Conversion Funnel
              </h3>
              <p className="text-[11px] text-zinc-500 mb-6">
                Customer progression through AI reception to confirmed booking.
              </p>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-zinc-600">Total Conversations</span>
                    <span className="font-semibold text-zinc-900">{data?.total_leads || 0}</span>
                  </div>
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-zinc-900 h-full rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-zinc-600">Autonomous AI Active</span>
                    <span className="font-semibold text-zinc-900">{data?.active_ai_count || 0}</span>
                  </div>
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all"
                      style={{
                        width: `${data?.total_leads ? Math.round((data.active_ai_count / data.total_leads) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-zinc-600">Confirmed Appointments</span>
                    <span className="font-semibold text-zinc-900">{data?.booked_count || 0}</span>
                  </div>
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-zinc-900 h-full rounded-full transition-all"
                      style={{
                        width: `${data?.conversion_rate || 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Service Demand Distribution */}
            <div className="rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-xs">
              <h3 className="text-xs font-semibold text-[#09090B] mb-1">
                Top Requested Services
              </h3>
              <p className="text-[11px] text-zinc-500 mb-6">
                Appointment volume breakdown by service category.
              </p>

              {data?.top_services && data.top_services.length > 0 ? (
                <div className="space-y-4">
                  {data.top_services.map((item: any, idx: number) => (
                    <div key={idx}>
                      <div className="flex justify-between text-xs font-medium mb-1.5">
                        <span className="text-zinc-700">{item.name}</span>
                        <span className="font-semibold text-zinc-900">
                          {item.count} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-zinc-900 h-full rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-zinc-400">
                  <Calendar className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                  <p className="text-xs font-medium text-zinc-600">No appointment bookings yet</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Service distribution will calculate automatically as appointments are scheduled.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
