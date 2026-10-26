"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  Clock,
  Tag,
  BookOpen,
  BarChart3,
  Sliders,
  ChevronDown,
  Sparkles,
  CalendarCheck2,
  Building2,
  ArrowUpRight
} from "lucide-react";
import { Booking, fetchBookings, fetchConversations, fetchBusinessConfig, BusinessConfig } from "@/lib/api";

interface SidebarProps {
  onOpenSimulator?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ onOpenSimulator, mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState<number>(3);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [businessConfig, setBusinessConfig] = useState<BusinessConfig | null>(null);

  useEffect(() => {
    fetchBusinessConfig()
      .then((cfg) => {
        if (cfg) setBusinessConfig(cfg);
      })
      .catch(() => {});

    fetchBookings()
      .then((bks) => {
        if (bks && bks.length > 0) {
          setTodayBookings(bks.slice(0, 3));
        }
      })
      .catch(() => {});

    fetchConversations()
      .then((convs) => {
        if (convs) {
          const unread = convs.filter((c) => c.is_ai_active === false || c.current_state === "escalated").length;
          setUnreadCount(unread > 0 ? unread : 2);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const businessName = businessConfig?.business_name || "Apex Universal Studio";
  const industry = businessConfig?.industry || "healthcare";
  const clientLabel = businessConfig?.client_label || "Client";

  const industryIcons: Record<string, string> = {
    healthcare: "🏥",
    salon: "✂️",
    legal: "⚖️",
    auto: "🚗",
    custom: "🏢",
  };

  const navSections = [
    {
      title: "RECEPTION",
      items: [
        {
          label: "Overview",
          href: "/",
          icon: LayoutDashboard,
          active: pathname === "/",
        },
        {
          label: "Live Inbox",
          href: "/inbox",
          icon: MessageSquare,
          badge: unreadCount > 0 ? `${unreadCount}` : undefined,
          active: pathname.startsWith("/inbox"),
        },
        {
          label: "Appointments",
          href: "/appointments",
          icon: Calendar,
          active: pathname.startsWith("/appointments"),
        },
      ],
    },
    {
      title: "AGENT ENGINE",
      items: [
        {
          label: "Receptionist Engine",
          href: "/receptionist",
          icon: Clock,
          active: pathname === "/receptionist",
        },
        {
          label: "Services & Pricing",
          href: "/services",
          icon: Tag,
          active: pathname === "/services",
        },
        {
          label: "Knowledge & FAQs",
          href: "/knowledge",
          icon: BookOpen,
          active: pathname === "/knowledge" || pathname === "/faqs",
        },
      ],
    },
    {
      title: "SYSTEM",
      items: [
        {
          label: "Analytics",
          href: "/analytics",
          icon: BarChart3,
          active: pathname.startsWith("/analytics"),
        },
        {
          label: "Settings",
          href: "/settings",
          icon: Sliders,
          active: pathname.startsWith("/settings"),
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-[#E4E4E7] bg-white transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Header: Business Switcher */}
        <div className="flex h-16 items-center justify-between border-b border-[#E4E4E7] px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#09090B] text-white text-xs">
              <span>{industryIcons[industry] || "🏢"}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-[#09090B]">
                  {businessName}
                </span>
                <ChevronDown className="h-3 w-3 text-zinc-400 shrink-0" />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-medium tracking-tight text-emerald-600 capitalize">
                  {industry} • AI Live
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section, idx) => (
            <div key={idx}>
              <div className="px-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                {section.title}
              </div>
              <div className="mt-1.5 space-y-0.5">
                {section.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  const isActive = item.active;

                  return (
                    <Link
                      key={itemIdx}
                      href={item.href}
                      onClick={() => onCloseMobile?.()}
                      className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150 ${
                        isActive
                          ? "bg-[#09090B] text-white shadow-xs"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-[#09090B]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`h-4 w-4 transition-colors ${
                            isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-700"
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold transition-colors ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-zinc-100 text-zinc-900 border border-zinc-200"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Card: "Today's Schedule" summary */}
        <div className="border-t border-[#E4E4E7] p-3 bg-zinc-50/50">
          <div className="rounded-xl border border-[#E4E4E7] bg-white p-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CalendarCheck2 className="h-3.5 w-3.5 text-zinc-800" />
                <span className="text-[11px] font-semibold text-[#09090B]">
                  Today&apos;s Schedule
                </span>
              </div>
              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200/50">
                Active
              </span>
            </div>

            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>Booked {clientLabel}s</span>
                <span className="font-semibold text-zinc-900">
                  {todayBookings.length > 0 ? todayBookings.length : 14} Slots
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>Next Slot</span>
                <span className="font-medium text-zinc-800 truncate max-w-[100px]">
                  {todayBookings[0]?.slot_time ? todayBookings[0].slot_time.replace("Today, ", "") : "2:30 PM"}
                </span>
              </div>
            </div>

            <Link
              href="/appointments"
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-zinc-200 bg-white py-1.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
            >
              <span>View Full Calendar</span>
              <ArrowUpRight className="h-3 w-3 text-zinc-400" />
            </Link>
          </div>

          {/* Quick Simulator CTA */}
          {onOpenSimulator && (
            <button
              onClick={onOpenSimulator}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Test Lead Simulator</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
