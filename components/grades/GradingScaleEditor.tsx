"use client";

import { useState, useTransition } from "react";
import { Star, Trash2, Plus, Save, X } from "lucide-react";
import {
  createGradingScale,
  updateGradingScale,
  deleteGradingScale,
  setDefaultScale,
  type GradingScale,
} from "@/lib/actions/grades";

type ThresholdDraft = {
  letter: string;
  min_score: number;
  color: string;
};

const DEFAULT_THRESHOLDS: ThresholdDraft[] = [
  { letter: "A", min_score: 90, color: "#22c55e" },
  { letter: "B", min_score: 80, color: "#3b82f6" },
  { letter: "C", min_score: 70, color: "#eab308" },
  { letter: "D", min_score: 60, color: "#f97316" },
  { letter: "F", min_score: 0, color: "#ef4444" },
];

export default function GradingScaleEditor({
  scales: initialScales,
}: {
  scales: GradingScale[];
}) {
  const [scales, setScales] = useState(initialScales);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editThresholds, setEditThresholds] = useState<ThresholdDraft[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newThresholds, setNewThresholds] = useState<ThresholdDraft[]>(
    DEFAULT_THRESHOLDS
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(scale: GradingScale) {
    setEditingId(scale.id);
    setEditName(scale.name);
    setEditThresholds(
      scale.thresholds.map((t) => ({
        letter: t.letter,
        min_score: Number(t.min_score),
        color: t.color || "#6b7280",
      }))
    );
    setCreating(false);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  function handleSave(scaleId: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", scaleId);
      fd.set("name", editName);
      fd.set("thresholds", JSON.stringify(editThresholds));
      const result = await updateGradingScale(fd);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setScales((prev) =>
          prev.map((s) =>
            s.id === scaleId
              ? {
                  ...s,
                  name: editName,
                  thresholds: editThresholds.map((t) => ({
                    id: "",
                    scale_id: scaleId,
                    letter: t.letter,
                    min_score: t.min_score,
                    color: t.color || null,
                  })),
                }
              : s
          )
        );
        setEditingId(null);
      }
    });
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", newName);
      fd.set("thresholds", JSON.stringify(newThresholds));
      const result = await createGradingScale(fd);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        // Refresh the page to get updated data
        window.location.reload();
      }
    });
  }

  function handleDelete(scaleId: string) {
    if (!confirm("Delete this grading scale?")) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", scaleId);
      const result = await deleteGradingScale(fd);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setScales((prev) => prev.filter((s) => s.id !== scaleId));
      }
    });
  }

  function handleSetDefault(scaleId: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", scaleId);
      const result = await setDefaultScale(fd);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setScales((prev) =>
          prev.map((s) => ({ ...s, is_default: s.id === scaleId }))
        );
      }
    });
  }

  function updateThreshold(
    thresholds: ThresholdDraft[],
    setThresholds: (t: ThresholdDraft[]) => void,
    index: number,
    field: keyof ThresholdDraft,
    value: string | number
  ) {
    const updated = [...thresholds];
    if (field === "min_score") {
      updated[index] = { ...updated[index], min_score: Number(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setThresholds(updated);
  }

  function addThreshold(
    thresholds: ThresholdDraft[],
    setThresholds: (t: ThresholdDraft[]) => void
  ) {
    setThresholds([...thresholds, { letter: "", min_score: 0, color: "#6b7280" }]);
  }

  function removeThreshold(
    thresholds: ThresholdDraft[],
    setThresholds: (t: ThresholdDraft[]) => void,
    index: number
  ) {
    setThresholds(thresholds.filter((_, i) => i !== index));
  }

  function renderThresholdTable(
    thresholds: ThresholdDraft[],
    setThresholds: (t: ThresholdDraft[]) => void
  ) {
    return (
      <div className="mt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-light text-left text-muted">
              <th className="pb-2 pr-3 font-medium">Letter</th>
              <th className="pb-2 pr-3 font-medium">Min Score</th>
              <th className="pb-2 pr-3 font-medium">Color</th>
              <th className="pb-2 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light">
            {thresholds
              .sort((a, b) => b.min_score - a.min_score)
              .map((t, i) => (
                <tr key={i}>
                  <td className="py-2 pr-3">
                    <input
                      type="text"
                      value={t.letter}
                      onChange={(e) =>
                        updateThreshold(
                          thresholds,
                          setThresholds,
                          i,
                          "letter",
                          e.target.value
                        )
                      }
                      className="w-16 rounded-lg border border-light bg-surface px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 ring-focus"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="999.99"
                      value={t.min_score}
                      onChange={(e) =>
                        updateThreshold(
                          thresholds,
                          setThresholds,
                          i,
                          "min_score",
                          e.target.value
                        )
                      }
                      className="w-24 rounded-lg border border-light bg-surface px-2 py-1 text-sm text-primary focus:outline-none focus:ring-2 ring-focus"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={t.color}
                        onChange={(e) =>
                          updateThreshold(
                            thresholds,
                            setThresholds,
                            i,
                            "color",
                            e.target.value
                          )
                        }
                        className="h-7 w-7 cursor-pointer rounded border border-light"
                      />
                      <span
                        className="inline-block rounded px-2 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.letter || "?"}
                      </span>
                    </div>
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() =>
                        removeThreshold(thresholds, setThresholds, i)
                      }
                      className="rounded p-1 text-muted hover:text-[var(--error-text)] transition-colors"
                      title="Remove threshold"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => addThreshold(thresholds, setThresholds)}
          className="mt-2 flex items-center gap-1 text-xs text-interactive hover:underline"
        >
          <Plus size={12} /> Add threshold
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] p-3 text-sm text-[var(--error-text)]">
          {error}
        </div>
      )}

      {scales.map((scale) => (
        <div
          key={scale.id}
          className="rounded-xl border border-light bg-surface p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetDefault(scale.id)}
                className={`rounded p-1 transition-colors ${
                  scale.is_default
                    ? "text-yellow-500"
                    : "text-muted hover:text-yellow-500"
                }`}
                title={
                  scale.is_default ? "Default scale" : "Set as default"
                }
                disabled={isPending}
              >
                <Star
                  size={16}
                  fill={scale.is_default ? "currentColor" : "none"}
                />
              </button>
              {editingId === scale.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-lg border border-light bg-surface px-2 py-1 text-sm font-medium text-primary focus:outline-none focus:ring-2 ring-focus"
                />
              ) : (
                <h4 className="font-medium text-primary">
                  {scale.name}
                  {scale.is_default && (
                    <span className="ml-2 text-xs text-muted">(default)</span>
                  )}
                </h4>
              )}
            </div>
            <div className="flex items-center gap-1">
              {editingId === scale.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSave(scale.id)}
                    disabled={isPending}
                    className="flex items-center gap-1 rounded-lg bg-interactive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Save size={12} /> Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(scale)}
                    className="rounded-lg px-3 py-1.5 text-xs text-interactive hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(scale.id)}
                    disabled={scale.is_default || isPending}
                    className="rounded p-1 text-muted hover:text-[var(--error-text)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      scale.is_default
                        ? "Cannot delete default scale"
                        : "Delete scale"
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {editingId === scale.id ? (
            renderThresholdTable(editThresholds, setEditThresholds)
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {scale.thresholds
                .sort((a, b) => Number(b.min_score) - Number(a.min_score))
                .map((t) => (
                  <span
                    key={t.letter}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                    style={{ backgroundColor: t.color || "#6b7280" }}
                  >
                    {t.letter}: {Number(t.min_score)}+
                  </span>
                ))}
            </div>
          )}
        </div>
      ))}

      {/* Create New Scale */}
      {creating ? (
        <div className="rounded-xl border-2 border-dashed border-light bg-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Scale name (e.g., AP, Simple)"
              className="rounded-lg border border-light bg-surface px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 ring-focus"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCreate}
                disabled={isPending || !newName.trim() || newThresholds.length === 0}
                className="flex items-center gap-1 rounded-lg bg-interactive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Save size={12} /> Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
          {renderThresholdTable(newThresholds, setNewThresholds)}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditingId(null);
            setNewName("");
            setNewThresholds([...DEFAULT_THRESHOLDS]);
            setError(null);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-light py-3 text-sm text-muted hover:border-interactive hover:text-interactive transition-colors"
        >
          <Plus size={16} /> Add Grading Scale
        </button>
      )}
    </div>
  );
}
