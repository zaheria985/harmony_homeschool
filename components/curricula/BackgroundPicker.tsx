"use client";
import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCurriculumBackground } from "@/lib/actions/lessons";

interface BackgroundPickerProps {
  curriculumId: string;
  currentImage: string | null;
}

export default function BackgroundPicker({
  curriculumId,
  currentImage,
}: BackgroundPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("curriculum_id", curriculumId);
    formData.set("file", file);
    startTransition(async () => {
      await updateCurriculumBackground(formData);
      router.refresh();
      setOpen(false);
    });
  }

  function handleUrlSubmit() {
    if (!url.trim()) return;
    const formData = new FormData();
    formData.set("curriculum_id", curriculumId);
    formData.set("url", url.trim());
    startTransition(async () => {
      await updateCurriculumBackground(formData);
      router.refresh();
      setOpen(false);
      setUrl("");
    });
  }

  function handleRemove() {
    const formData = new FormData();
    formData.set("curriculum_id", curriculumId);
    formData.set("remove", "true");
    startTransition(async () => {
      await updateCurriculumBackground(formData);
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-md border border-light p-1.5 text-muted hover:text-interactive hover:bg-surface-muted transition-colors"
        title="Set background image"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        {currentImage && (
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-surface bg-interactive"
            style={{
              backgroundImage: `url(${currentImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute z-50 mt-1 w-64 rounded-lg border border-light bg-surface shadow-lg p-3"
        >
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`text-xs ${
                tab === "upload"
                  ? "text-interactive font-medium"
                  : "text-muted hover:text-primary"
              }`}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => setTab("url")}
              className={`text-xs ${
                tab === "url"
                  ? "text-interactive font-medium"
                  : "text-muted hover:text-primary"
              }`}
            >
              URL
            </button>
          </div>

          {isPending && (
            <div className="text-xs text-muted mb-2">Saving...</div>
          )}

          {tab === "upload" && (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isPending}
                className="w-full text-sm text-primary file:mr-2 file:rounded-md file:border file:border-light file:bg-surface file:px-2 file:py-1 file:text-xs file:text-muted hover:file:text-interactive file:cursor-pointer"
              />
            </div>
          )}

          {tab === "url" && (
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                disabled={isPending}
                className="w-full rounded-md border border-light bg-surface px-2 py-1.5 text-sm text-primary placeholder:text-muted focus:border-interactive focus:ring-1 focus:ring-focus"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUrlSubmit();
                }}
              />
              <button
                type="button"
                onClick={handleUrlSubmit}
                disabled={isPending || !url.trim()}
                className="shrink-0 rounded-md bg-interactive px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Set
              </button>
            </div>
          )}

          {currentImage && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="mt-3 w-full text-xs text-muted hover:text-primary transition-colors disabled:opacity-50"
            >
              Remove background
            </button>
          )}
        </div>
      )}
    </div>
  );
}
