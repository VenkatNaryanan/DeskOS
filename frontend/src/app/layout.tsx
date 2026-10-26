import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apex Healthcare | Autonomous AI Receptionist & Lead Engine",
  description: "Ultra-clean WhatsApp AI Receptionist & Lead Automation Dashboard powered by Groq & Supabase",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-white text-[#09090b]">
      <body className="min-h-full bg-white text-[#09090b] antialiased selection:bg-zinc-200 selection:text-black">
        {children}
      </body>
    </html>
  );
}
