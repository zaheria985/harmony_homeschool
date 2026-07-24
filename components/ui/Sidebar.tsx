"use client";
import SearchCommand from "@/components/ui/SearchCommand";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Sun as SunIcon,
  Palette,
  BookOpen,
  BookOpenCheck,
  ListChecks,
  ClipboardList,
  Package,
  Library,
  Tags,
  Calendar,
  TrendingUp,
  Settings,
  Users,
  UserCog,
  GraduationCap,
  Sun,
  Moon,
  PanelLeftOpen,
  PanelLeftClose,
  LogOut,
  X,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string | null; items: NavItem[] };

/**
 * Parent navigation, grouped so sixteen destinations read as five ideas.
 * "Today" sits alone at the top because it is where the day starts.
 */
const navGroups: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/today", label: "Today", icon: SunIcon }],
  },
  {
    label: "Plan",
    items: [
      { href: "/week", label: "Planner", icon: ClipboardList },
      { href: "/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "School",
    items: [
      { href: "/students", label: "Students", icon: GraduationCap },
      { href: "/subjects", label: "Subjects", icon: Palette },
      { href: "/curricula", label: "Courses", icon: BookOpen },
      { href: "/lessons/table", label: "Lessons", icon: ListChecks },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/resources", label: "Resources", icon: Package },
      { href: "/booklists", label: "Booklists", icon: Library },
      { href: "/reading", label: "Reading Log", icon: BookOpenCheck },
      { href: "/tags", label: "Tags", icon: Tags },
    ],
  },
  {
    label: "Family",
    items: [
      { href: "/reports", label: "Progress Reports", icon: TrendingUp },
      { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
      { href: "/admin", label: "Admin", icon: Settings },
      { href: "/settings/users", label: "Users", icon: Users },
    ],
  },
];

const accountNavItem: NavItem = {
  href: "/settings/account",
  label: "Account",
  icon: UserCog,
};

/** `/lessons/table` should stay lit while viewing `/lessons/table/anything`. */
function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${collapsed ? "justify-center" : "gap-3"} ${
        active
          ? "border-l-2 border-l-[var(--brand)] bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]"
          : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--app-text)]"
      }`}
      title={collapsed ? item.label : undefined}
    >
      <Icon size={20} />
      {!collapsed && item.label}
    </Link>
  );
}

export default function Sidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
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
  const closeMobile = () => onMobileOpenChange(false);
  return (
    <>
      {mobileOpen && (
        <button
          onClick={closeMobile}
          aria-label="Close navigation menu"
          className="fixed left-4 top-4 z-50 rounded-xl bg-[var(--brand)] p-2 text-[var(--brand-contrast)] shadow-warm-md print:hidden md:hidden"
        >
          <X size={20} />
        </button>
      )}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[var(--overlay)] md:hidden"
          onClick={closeMobile}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-warm-lg transition-all md:static md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} ${desktopCollapsed ? "md:w-20" : "md:w-64"}`}
      >
        <div
          className={`flex h-16 items-center border-b border-[var(--border)] ${desktopCollapsed ? "justify-center px-2" : "justify-between px-4"}`}
        >
          <span className="font-display text-2xl text-[var(--brand)]">
            {desktopCollapsed ? "H" : "Harmony"}
          </span>
          {!desktopCollapsed && (
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-[var(--border)] p-1.5 text-sm transition-colors hover:bg-[var(--sidebar-hover)]"
              title={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
            >
              {theme === "dark" ? (
                <Sun size={16} className="text-[var(--warning-solid)]" />
              ) : (
                <Moon size={16} className="text-[var(--text-tertiary)]" />
              )}
            </button>
          )}
        </div>
        {!desktopCollapsed && (
          <div className="px-3 pt-3">
            <SearchCommand />
          </div>
        )}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group, index) => (
            <div key={group.label ?? "primary"} className={index > 0 ? "mt-4" : ""}>
              {group.label && !desktopCollapsed && (
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted-text)]">
                  {group.label}
                </p>
              )}
              {group.label && desktopCollapsed && (
                <div className="mx-2 mb-2 border-t border-[var(--border)]" />
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActivePath(pathname, item.href)}
                    collapsed={desktopCollapsed}
                    onNavigate={closeMobile}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="my-3 border-t border-[var(--border)]" />
          <NavLink
            item={accountNavItem}
            active={isActivePath(pathname, accountNavItem.href)}
            collapsed={desktopCollapsed}
            onNavigate={closeMobile}
          />
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
