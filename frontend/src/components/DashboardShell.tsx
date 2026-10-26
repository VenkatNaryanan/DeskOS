"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import LeadSimulatorDrawer from "@/components/LeadSimulatorDrawer";
import { Sparkles, Menu } from "lucide-react";

interface DashboardShellProps {
  children: React.ReactNode;
  onRefresh?: () => void;
}

export default function DashboardShell({ children, onRefresh }: DashboardShellProps) {
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-[#09090B] flex flex-col antialiased">
      {/* Mobile Top Navigation bar */}
      <div className="flex h-14 items-center justify-between border-b border-[#E4E4E7] bg-white px-4 lg:hidden sticky top-0 z-30">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="rounded-lg border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-100"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold text-[#09090B]">
          Apex Dental Clinic
        </span>
        <button
          onClick={() => setSimulatorOpen(true)}
          className="flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-xs"
        >
          <Sparkles className="h-3 w-3 text-amber-300" />
          <span>Simulate</span>
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Left Sidebar */}
        <Sidebar
          onOpenSimulator={() => setSimulatorOpen(true)}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Spacious Main Content Area */}
        <main className="flex-1 lg:pl-64 flex flex-col min-w-0 bg-white">
          {children}
        </main>
      </div>

      {/* Floating Global Simulator Button for large screens */}
      <div className="fixed bottom-5 right-5 z-40 hidden lg:block">
        <button
          onClick={() => setSimulatorOpen(true)}
          className="group flex items-center gap-2 rounded-full border border-zinc-900/10 bg-[#09090B] px-4 py-2.5 text-xs font-semibold text-white shadow-xl hover:bg-zinc-800 hover:shadow-2xl active:scale-95 transition-all"
        >
          <Sparkles className="h-4 w-4 text-amber-300 transition-transform group-hover:rotate-12" />
          <span>Test Lead Simulator</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>
      </div>

      {/* Global Testing Drawer */}
      <LeadSimulatorDrawer
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        onRefreshParent={onRefresh}
      />
    </div>
  );
}
