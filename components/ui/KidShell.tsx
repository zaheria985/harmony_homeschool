"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import BottomTabs from "@/components/ui/BottomTabs";
import type { KidColor } from "@/lib/utils/kid-colors";

/**
 * Kid chrome: no admin sidebar, no search, no settings. Just who you are, a
 * warm greeting, and four big tabs. Sign-out hides behind the avatar so it is
 * reachable but not tempting.
 */
export default function KidShell({
  name,
  color,
  children,
}: {
  name: string;
  color: KidColor;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-light bg-surface px-4 py-3">
        <div className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={`Account menu for ${name}`}
            aria-expanded={menuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 font-display text-lg"
            style={{
              backgroundColor: color.bg,
              borderColor: color.solid,
              color: color.text,
            }}
          >
            {initial}
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-2 w-40 rounded-xl border border-light bg-surface p-1 shadow-warm-lg">
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary hover:bg-surface-muted"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-lg text-primary">
            {greeting()}, {name}
          </p>
          <p className="text-xs italic text-tertiary">{todayLabel()}</p>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 pb-24">{children}</main>
      <BottomTabs variant="kid" />
    </div>
  );
}

/** Client-side clock is correct here — this greets the kid at their device. */
function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
