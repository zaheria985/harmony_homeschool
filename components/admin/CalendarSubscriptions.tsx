"use client";

import { useState } from "react";

interface Child {
  id: string;
  name: string;
}

interface CalendarSubscriptionsProps {
  kids: Child[];
  baseUrl: string;
  hasToken: boolean;
}

export default function CalendarSubscriptions({
  kids,
  baseUrl,
  hasToken,
}: CalendarSubscriptionsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function buildUrl(childId?: string) {
    const params = new URLSearchParams();
    if (hasToken) params.set("token", "YOUR_ICAL_TOKEN");
    if (childId) params.set("child", childId);
    const qs = params.toString();
    return `${baseUrl}/api/calendar/ical${qs ? `?${qs}` : ""}`;
  }

  async function copyToClipboard(id: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Subscribe to lesson schedules and external events from any calendar app
        (Google Calendar, Apple Calendar, Outlook, etc.). Copy a URL below and
        add it as a calendar subscription.
      </p>

      {hasToken && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>Note:</strong> Replace <code>YOUR_ICAL_TOKEN</code> in the
          URLs below with your actual <code>ICAL_TOKEN</code> environment
          variable value.
        </div>
      )}

      {/* All-children feed */}
      <div className="rounded-lg border border-light bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <span className="font-medium text-primary">
              All Students — Combined Feed
            </span>
            <p className="text-xs text-muted">
              Includes all lessons and external events
            </p>
          </div>
          <button
            onClick={() => copyToClipboard("all", buildUrl())}
            className="rounded-md bg-interactive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            {copiedId === "all" ? "Copied!" : "Copy URL"}
          </button>
        </div>
        <code className="block break-all rounded bg-surface-muted px-2 py-1 text-xs text-secondary">
          {buildUrl()}
        </code>
      </div>

      {/* Per-child feeds */}
      {kids.map((child) => (
        <div
          key={child.id}
          className="rounded-lg border border-light bg-surface p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <div>
              <span className="font-medium text-primary">{child.name}</span>
              <p className="text-xs text-muted">
                Lessons and events for {child.name} only
              </p>
            </div>
            <button
              onClick={() =>
                copyToClipboard(child.id, buildUrl(child.id))
              }
              className="rounded-md bg-interactive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              {copiedId === child.id ? "Copied!" : "Copy URL"}
            </button>
          </div>
          <code className="block break-all rounded bg-surface-muted px-2 py-1 text-xs text-secondary">
            {buildUrl(child.id)}
          </code>
        </div>
      ))}

      <p className="text-xs text-tertiary">
        This is a one-way feed — changes in Harmony are reflected automatically
        when your calendar app refreshes (typically every 15-60 minutes).
        Two-way sync (marking lessons complete from your calendar) is not
        currently supported.
      </p>
    </div>
  );
}
