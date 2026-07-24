"use client";
import { useState } from "react";
import Sidebar from "@/components/ui/Sidebar";
import BottomTabs from "@/components/ui/BottomTabs";

/**
 * Parent chrome: grouped sidebar on desktop, drawer plus bottom tabs on a
 * phone. The drawer's open state lives here because the "More" tab opens the
 * same drawer the sidebar renders.
 */
export default function ParentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <main className="flex-1 overflow-auto p-6 pb-24 transition-colors md:p-10 md:pb-10">
        <div className="mx-auto">{children}</div>
      </main>
      <BottomTabs variant="parent" onMore={() => setMobileOpen(true)} />
    </div>
  );
}
