"use client";
import { useState } from "react";

export default function BooklistExportButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-light bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted"
      >
        Export Booklist
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-light bg-surface shadow-lg">
          <a
            href="/api/export/booklist"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-primary hover:bg-surface-muted"
          >
            Print View (HTML)
          </a>
          <a
            href="/api/export/booklist?format=txt"
            download="booklist.txt"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-primary hover:bg-surface-muted"
          >
            Download as Text
          </a>
        </div>
      )}
    </div>
  );
}
