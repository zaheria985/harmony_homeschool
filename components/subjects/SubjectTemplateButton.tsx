"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applySubjectTemplate } from "@/lib/actions/lessons";

const TEMPLATES = [
  { key: "classical", label: "Classical" },
  { key: "charlotte_mason", label: "Charlotte Mason" },
  { key: "traditional", label: "Traditional" },
];

export default function SubjectTemplateButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleSelect(key: string) {
    setMessage("");
    startTransition(async () => {
      const result = await applySubjectTemplate(key);
      if ("error" in result && result.error) {
        setMessage(result.error);
      } else if (result.success) {
        const created = "created" in result ? result.created : 0;
        const skipped = "skipped" in result ? result.skipped : 0;
        if (created === 0) {
          setMessage(`All subjects already exist (${skipped} skipped).`);
        } else {
          setMessage(
            `Added ${created} subject${created !== 1 ? "s" : ""}${skipped ? ` (${skipped} already existed)` : ""}.`
          );
        }
        router.refresh();
      }
      setTimeout(() => {
        setMessage("");
        setOpen(false);
      }, 2000);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-light bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted"
      >
        Load Template
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-light bg-surface shadow-lg">
          <div className="px-3 py-2 text-xs font-medium uppercase text-muted">
            Homeschool Approach
          </div>
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={isPending}
              onClick={() => handleSelect(t.key)}
              className="block w-full px-3 py-2 text-left text-sm text-primary hover:bg-surface-muted disabled:opacity-50"
            >
              {t.label}
            </button>
          ))}
          {message && (
            <div className="border-t border-light px-3 py-2 text-xs text-muted">
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
