"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Palette,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Package,
  Library,
  Tags,
  Calendar,
  TrendingUp,
  Settings,
  Users,
  Sun,
  Moon,
  PanelLeftOpen,
  PanelLeftClose,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/subjects", label: "Subjects", icon: Palette },
  { href: "/curricula", label: "Courses", icon: BookOpen },
  { href: "/week", label: "Planner", icon: ClipboardList },
  { href: "/prep", label: "Weekly Prep", icon: CalendarDays },
  { href: "/resources", label: "Resources", icon: Package },
  { href: "/booklists", label: "Booklists", icon: Library },
  { href: "/tags", label: "Tags", icon: Tags },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/reports", label: "Progress Reports", icon: TrendingUp },
];
const adminNavItem = { href: "/admin", label: "Admin", icon: Settings };
const settingsNavItem = { href: "/settings/users", label: "Users", icon: Users };

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const storedTheme = localStorage.getItem("theme");
    const storedSidebar = localStorage.getItem("sidebar-collapsed");
    const nextTheme =
      storedTheme === "dark" || (!storedTheme && prefersDark)
        ? "dark"
        : "light";
    setTheme(nextTheme);
    setDesktopCollapsed(storedSidebar === "true");
    root.classList.toggle("dark", nextTheme === "dark");
  }, []);
  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem("theme", nextTheme);
  }
  function toggleDesktopSidebar() {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }
  const role =
    (session?.user as { role?: string } | undefined)?.role || "parent";
  const visibleItems =
    role === "kid"
      ? mainNavItems.filter((item) =>
          ["/dashboard", "/calendar", "/booklists"].includes(item.href),
        )
      : mainNavItems;
  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={
          mobileOpen ? "Close navigation menu" : "Open navigation menu"
        }
        className="fixed left-4 top-4 z-50 rounded-xl bg-[var(--brand)] p-2 text-[var(--brand-contrast)] shadow-warm-md md:hidden"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[var(--overlay)] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-warm-lg transition-all md:static md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} ${desktopCollapsed ? "md:w-20" : "md:w-64"}`}
      >
        <div
          className={`flex h-16 items-center border-b border-[var(--border)] ${desktopCollapsed ? "justify-center px-2" : "justify-between px-4"}`}
        >
          {desktopCollapsed ? (
            <span className="font-display text-2xl text-[var(--brand)]">H</span>
          ) : (
            <span className="font-display text-2xl text-[var(--brand)]">
              Harmony
            </span>
          )}
          <button
            onClick={toggleTheme}
            className="rounded-xl border border-[var(--border)] p-1.5 text-sm transition-colors hover:bg-[var(--sidebar-hover)]"
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              <Sun size={16} className="text-[var(--warning-solid)]" />
            ) : (
              <Moon size={16} className="text-[var(--text-tertiary)]" />
            )}
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${desktopCollapsed ? "justify-center" : "gap-3"} ${active ? "border-l-2 border-l-[var(--brand)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]" : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--app-text)]"}`}
                title={desktopCollapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!desktopCollapsed && item.label}
              </Link>
            );
          })}
          {role !== "kid" && (
            <>
              <div className="my-2 border-t border-[var(--border)]" />
              {[adminNavItem, settingsNavItem].map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${desktopCollapsed ? "justify-center" : "gap-3"} ${active ? "border-l-2 border-l-[var(--brand)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]" : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--app-text)]"}`}
                    title={desktopCollapsed ? item.label : undefined}
                  >
                    <Icon size={20} />
                    {!desktopCollapsed && item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        <div className="border-t border-[var(--border)] p-4">
          <button
            onClick={toggleDesktopSidebar}
            aria-label={
              desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            className="mb-2 hidden w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--app-text)] md:flex"
          >
            {desktopCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <>
                <PanelLeftClose size={18} />
                <span>Collapse</span>
              </>
            )}
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Sign out"
            className={`flex w-full items-center rounded-xl px-3 py-2 text-sm text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--app-text)] ${desktopCollapsed ? "justify-center" : "gap-2"}`}
            title={desktopCollapsed ? "Sign Out" : undefined}
          >
            <LogOut size={18} />
            {!desktopCollapsed && "Sign Out"}
          </button>
          <p
            className={`mt-2 px-3 text-xs text-[var(--muted-text)] ${desktopCollapsed ? "text-center" : ""}`}
          >
            Harmony Homeschool v0.1
          </p>
        </div>
      </aside>
    </>
  );
}
