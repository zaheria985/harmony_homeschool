"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ViewOption = {
  key: string;
  label: string;
  href?: string;
};

// State-based toggle with localStorage persistence
export default function ViewToggle({
  storageKey,
  options,
  defaultView,
  onChange,
}: {
  storageKey: string;
  options: ViewOption[];
  defaultView: string;
  onChange: (view: string) => void;
}) {
  const [view, setView] = useState(defaultView);
  const [mounted, setMounted] = useState(false);

  const stableOnChange = useCallback(onChange, [onChange]);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored && options.some((o) => o.key === stored)) {
      setView(stored);
      stableOnChange(stored);
    }
    setMounted(true);
  }, [storageKey, options, stableOnChange]);

  function handleChange(key: string) {
    setView(key);
    localStorage.setItem(storageKey, key);
    stableOnChange(key);
  }

  const activeView = mounted ? view : defaultView;

  return (
    <div className="flex rounded-lg border bg-white">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => handleChange(opt.key)}
          className={`px-3 py-1.5 text-sm font-medium transition-colors ${
            activeView === opt.key
              ? "bg-primary-50 text-primary-700"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Navigation-based toggle (for pages on different routes)
export function ViewToggleNav({
  options,
}: {
  options: ViewOption[];
}) {
  const pathname = usePathname();

  return (
    <div className="flex rounded-lg border bg-white">
      {options.map((opt) => {
        const active = opt.href === pathname;
        return (
          <Link
            key={opt.key}
            href={opt.href || "#"}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary-50 text-primary-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
