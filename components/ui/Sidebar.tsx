"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/students", label: "Students", icon: "👨‍🎓" },
  { href: "/subjects", label: "Subjects", icon: "🎨" },
  { href: "/curricula", label: "Courses", icon: "📖" },
  { href: "/week", label: "Planner", icon: "📚" },
  { href: "/grades", label: "Grades", icon: "📝" },
  { href: "/resources", label: "Resources", icon: "📦" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/completed", label: "Completed", icon: "✅" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/admin", label: "Admin", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-primary-600 p-2 text-white shadow-lg md:hidden"
      >
        {collapsed ? "✕" : "☰"}
      </button>

      {/* Overlay for mobile */}
      {collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setCollapsed(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white shadow-lg transition-transform md:static md:translate-x-0 ${
          collapsed ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <span className="text-2xl font-bold text-primary-600">Harmony</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setCollapsed(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Sign Out
          </button>
          <p className="mt-2 px-3 text-xs text-gray-400">
            Harmony Homeschool v0.1
          </p>
        </div>
      </aside>
    </>
  );
}
