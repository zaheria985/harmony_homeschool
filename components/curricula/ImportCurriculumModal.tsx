"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { importCurriculum } from "@/lib/actions/lessons";

interface ImportCurriculumModalProps {
  subjects: { id: string; name: string }[];
}

export default function ImportCurriculumModal({ subjects }: ImportCurriculumModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || "");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        try {
          const parsed = JSON.parse(text);
          if (!parsed.harmony_curriculum_export) {
            setError("This file does not appear to be a Harmony curriculum export.");
            setFileContent("");
            return;
          }
          setFileContent(text);
        } catch {
          setError("Invalid JSON file.");
          setFileContent("");
        }
      }
    };
    reader.readAsText(file);
  }

  function handleSubmit() {
    if (!fileContent) {
      setError("Please select a valid curriculum JSON file.");
      return;
    }
    if (!selectedSubjectId) {
      setError("Please select a subject.");
      return;
    }

    const fd = new FormData();
    fd.set("json", fileContent);
    fd.set("subjectId", selectedSubjectId);

    startTransition(async () => {
      const result = await importCurriculum(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        setFileName("");
        setFileContent("");
        setError("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-light px-3 py-1.5 text-sm font-medium text-tertiary hover:bg-surface-muted"
      >
        Import Curriculum
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-primary">Import Curriculum</h2>
          <p className="text-sm text-muted">
            Upload a curriculum JSON file exported from Harmony Homeschool.
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-light bg-surface-muted px-4 py-6 text-center text-sm text-muted hover:border-interactive hover:text-interactive"
            >
              {fileName || "Click to select a JSON file"}
            </button>
          </div>

          {error && (
            <p className="text-sm text-[var(--error-text)]">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-light px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !fileContent || !selectedSubjectId}
              className="rounded-lg bg-interactive px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
