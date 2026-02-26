"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";

type Child = { id: string; name: string };
type Subject = { id: string; name: string };

const FORMAT_HINTS: Record<string, string> = {
  lessons: `CSV columns: title, description, date, status
Tab or comma separated. First row must be headers.

Example CSV:
title,description,date,status
Fractions Intro,Learn basic fractions,2026-03-01,planned
Fractions Practice,Worksheet,2026-03-02,planned

Example JSON:
[
  {"title": "Fractions Intro", "description": "Learn basic fractions", "date": "2026-03-01"},
  {"title": "Fractions Practice", "description": "Worksheet", "date": "2026-03-02"}
]`,
  books: `CSV columns: title, author, isbn
Tab or comma separated. First row must be headers.

Example CSV:
title,author,isbn
Charlotte's Web,E.B. White,978-0061124952
The Hobbit,J.R.R. Tolkien,978-0547928227

Example JSON:
[
  {"title": "Charlotte's Web", "author": "E.B. White"},
  {"title": "The Hobbit", "author": "J.R.R. Tolkien"}
]`,
};

export default function PlatformImportModal({
  open,
  onClose,
  children,
  subjects,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  children: Child[];
  subjects: Subject[];
  onImport: (fd: FormData) => Promise<{ success?: boolean; imported?: number; error?: string }>;
}) {
  const [importType, setImportType] = useState<"lessons" | "books">("lessons");
  const [data, setData] = useState("");
  const [childId, setChildId] = useState(children[0]?.id || "");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [curriculumName, setCurriculumName] = useState("");
  const [result, setResult] = useState<{ success?: boolean; imported?: number; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setResult(null);
    const fd = new FormData();
    fd.set("type", importType);
    fd.set("data", data);
    if (importType === "lessons") {
      fd.set("childId", childId);
      fd.set("subjectId", subjectId);
      fd.set("curriculumName", curriculumName);
    }
    startTransition(async () => {
      const res = await onImport(fd);
      setResult(res);
      if (res.success) {
        setData("");
        setCurriculumName("");
      }
    });
  }

  function handleClose() {
    setResult(null);
    setData("");
    setCurriculumName("");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import Data" className="max-w-2xl">
      <div className="space-y-4">
        {/* Import Type */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Import Type
          </label>
          <select
            value={importType}
            onChange={(e) => {
              setImportType(e.target.value as "lessons" | "books");
              setResult(null);
            }}
            className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <option value="lessons">Lessons</option>
            <option value="books">Books</option>
          </select>
        </div>

        {/* Lesson-specific fields */}
        {importType === "lessons" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  Student
                </label>
                <select
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  Subject
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                Curriculum Name
              </label>
              <input
                type="text"
                value={curriculumName}
                onChange={(e) => setCurriculumName(e.target.value)}
                placeholder="Imported Lessons"
                className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              />
            </div>
          </>
        )}

        {/* Format hints */}
        <div className="rounded-lg border border-light bg-surface-subtle p-3">
          <p className="mb-1 text-xs font-medium text-secondary">
            Expected Format (CSV or JSON)
          </p>
          <pre className="whitespace-pre-wrap text-xs text-tertiary">
            {FORMAT_HINTS[importType]}
          </pre>
        </div>

        {/* Data textarea */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Paste CSV or JSON Data
          </label>
          <textarea
            value={data}
            onChange={(e) => setData(e.target.value)}
            rows={8}
            placeholder="Paste your data here..."
            className="w-full rounded-lg border border-light bg-surface px-3 py-2 font-mono text-sm text-primary placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>

        {/* Result message */}
        {result && (
          <div
            className={`rounded-lg p-3 text-sm ${
              result.error
                ? "border border-red-200 bg-red-50 text-red-800"
                : "border border-green-200 bg-green-50 text-green-800"
            }`}
          >
            {result.error
              ? result.error
              : `Successfully imported ${result.imported} item${result.imported === 1 ? "" : "s"}.`}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-light bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !data.trim()}
            className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
