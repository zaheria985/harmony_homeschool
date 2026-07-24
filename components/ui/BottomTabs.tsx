"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  ClipboardList,
  ClipboardCheck,
  Menu,
  CalendarDays,
  BookOpenCheck,
  Library,
  type LucideIcon,
} from "lucide-react";

export type TabKey =
  | "today"
  | "planner"
  | "approvals"
  | "more"
  | "week"
  | "reading"
  | "books";

type Tab = {
  key: TabKey;
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Parent phone tabs — the four things reached most during a school day. */
const parentTabs: Tab[] = [
  { key: "today", href: "/today", label: "Today", icon: Sun },
  { key: "planner", href: "/week", label: "Planner", icon: ClipboardList },
  {
    key: "approvals",
    href: "/approvals",
    label: "Approvals",
    icon: ClipboardCheck,
  },
];

/** Kid tabs — the whole app, on every screen size. */
const kidTabs: Tab[] = [
  { key: "today", href: "/today", label: "My Day", icon: Sun },
  { key: "week", href: "/week", label: "My Week", icon: CalendarDays },
  { key: "reading", href: "/reading", label: "Reading", icon: BookOpenCheck },
  { key: "books", href: "/booklists", label: "Books", icon: Library },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomTabs({
  variant,
  onMore,
}: {
  variant: "parent" | "kid";
  /** Parent only: opens the full nav drawer. */
  onMore?: () => void;
}) {
  const pathname = usePathname();
  const tabs = variant === "parent" ? parentTabs : kidTabs;

  return (
    <nav
      aria-label={variant === "kid" ? "Main" : "Quick navigation"}
      className={`fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--border)] bg-[var(--sidebar-bg)] pb-[env(safe-area-inset-bottom)] shadow-warm-lg print:hidden ${
        variant === "parent" ? "md:hidden" : ""
      }`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium transition-colors ${
              active
                ? "text-[var(--sidebar-active-text)]"
                : "text-[var(--sidebar-text)]"
            }`}
          >
            <Icon size={22} />
            {tab.label}
          </Link>
        );
      })}
      {variant === "parent" && (
        <button
          onClick={onMore}
          aria-label="Open navigation menu"
          className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium text-[var(--sidebar-text)]"
        >
          <Menu size={22} />
          More
        </button>
      )}
    </nav>
  );
}
