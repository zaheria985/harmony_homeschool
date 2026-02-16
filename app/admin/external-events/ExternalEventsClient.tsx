"use client";
import { useMemo, useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import {
  createExternalEvent,
  deleteExternalEvent,
  updateExternalEvent,
} from "@/lib/actions/external-events";
import { formatTimeRange, parseImportedDates } from "@/lib/utils/recurrence";
import type { ExternalEvent } from "@/types/external-events";
type Child = { id: string; name: string };
function recurrenceLabel(event: ExternalEvent): string {
  if (event.recurrence_type === "once")
    return `One-time on ${event.start_date}`;
  if (event.recurrence_type === "weekly") return "Weekly";
  if (event.recurrence_type === "biweekly") return "Biweekly";
  return "Monthly";
}
const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary";
export default function ExternalEventsClient({
  children,
  events,
}: {
  children: Child[];
  events: ExternalEvent[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ExternalEvent | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("14:00");
  const [allDay, setAllDay] = useState(false);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);
  const [pastedDates, setPastedDates] = useState("");
  const [editRecurrence, setEditRecurrence] = useState<
    "once" | "weekly" | "biweekly" | "monthly"
  >("weekly");
  const [editDayOfWeek, setEditDayOfWeek] = useState("1");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editExceptionDates, setEditExceptionDates] = useState("");
  const [editExceptionReason, setEditExceptionReason] =
    useState("Holiday/Break");
  const importPreview = useMemo(() => {
    if (!pastedDates.trim()) return null;
    return parseImportedDates(pastedDates);
  }, [pastedDates]);
  function resetCreate() {
    setTitle("");
    setDescription("");
    setColor("#3b82f6");
    setStartTime("09:00");
    setEndTime("14:00");
    setAllDay(false);
    setSelectedChildren([]);
    setPastedDates("");
    setError("");
  }
  function openEdit(event: ExternalEvent) {
    setEditing(event);
    setTitle(event.title);
    setDescription(event.description || "");
    setColor(event.color || "#3b82f6");
    setStartTime(event.start_time || "");
    setEndTime(event.end_time || "");
    setAllDay(event.all_day);
    setSelectedChildren(event.children.map((child) => child.id));
    setEditRecurrence(event.recurrence_type);
    setEditDayOfWeek(String(event.day_of_week ?? 1));
    setEditStartDate(event.start_date);
    setEditEndDate(event.end_date || "");
    setEditExceptionDates(event.exception_dates.join("\n"));
    setEditExceptionReason("Holiday/Break");
    setError("");
  }
  function toggleChild(childId: string) {
    setSelectedChildren((prev) =>
      prev.includes(childId)
        ? prev.filter((id) => id !== childId)
        : [...prev, childId],
    );
  }
  function handleCreate() {
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("description", description);
      formData.set("color", color);
      formData.set("start_time", startTime);
      formData.set("end_time", endTime);
      formData.set("all_day", allDay ? "true" : "false");
      formData.set("pasted_dates", pastedDates);
      for (const childId of selectedChildren)
        formData.append("child_ids", childId);
      const result = await createExternalEvent(formData);
      if ("error" in result) {
        setError(result.error || "Failed to create event");
        return;
      }
      setShowCreate(false);
      resetCreate();
    });
  }
  function handleUpdate() {
    if (!editing) return;
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", editing.id);
      formData.set("title", title);
      formData.set("description", description);
      formData.set("color", color);
      formData.set("start_time", startTime);
      formData.set("end_time", endTime);
      formData.set("all_day", allDay ? "true" : "false");
      formData.set("recurrence_type", editRecurrence);
      formData.set("day_of_week", editDayOfWeek);
      formData.set("start_date", editStartDate);
      formData.set("end_date", editEndDate);
      formData.set("exception_dates", editExceptionDates);
      formData.set("exception_reason", editExceptionReason);
      for (const childId of selectedChildren)
        formData.append("child_ids", childId);
      const result = await updateExternalEvent(formData);
      if ("error" in result) {
        setError(result.error || "Failed to update event");
        return;
      }
      setEditing(null);
      setError("");
    });
  }
  function handleDelete(eventId: string) {
    if (!confirm("Delete this external event?")) return;
    setError("");
    startTransition(async () => {
      const result = await deleteExternalEvent(eventId);
      if ("error" in result) {
        setError(result.error || "Failed to delete event");
      }
    });
  }
  return (
    <div className="space-y-4">
      {" "}
      <div className="flex justify-end">
        {" "}
        <button
          onClick={() => {
            resetCreate();
            setShowCreate(true);
          }}
          className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
        >
          {" "}
          + Import From Paste{" "}
        </button>{" "}
      </div>{" "}
      {error && (
        <div className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] p-3 text-sm text-red-700">
          {" "}
          {error}{" "}
        </div>
      )}{" "}
      {events.length === 0 ? (
        <div className="rounded-xl border border-light bg-surface p-8 text-center text-sm text-muted">
          {" "}
          No external school events yet.{" "}
        </div>
      ) : (
        <div className="space-y-3">
          {" "}
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-light bg-surface p-4 shadow-sm"
            >
              {" "}
              <div className="flex items-start justify-between gap-3">
                {" "}
                <div>
                  {" "}
                  <div className="flex items-center gap-2">
                    {" "}
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />{" "}
                    <h3 className="text-sm font-semibold text-primary">
                      {event.title}
                    </h3>{" "}
                  </div>{" "}
                  <p className="mt-1 text-xs text-muted">
                    {" "}
                    {recurrenceLabel(event)}{" "}
                    {event.end_date
                      ? `(${event.start_date} to ${event.end_date})`
                      : ""}{" "}
                  </p>{" "}
                  <p className="text-xs text-muted">
                    {" "}
                    {formatTimeRange(
                      event.start_time,
                      event.end_time,
                      event.all_day,
                    )}{" "}
                  </p>{" "}
                  <p className="text-xs text-muted">
                    {" "}
                    Students:{" "}
                    {event.children.map((child) => child.name).join(",")}{" "}
                  </p>{" "}
                  {event.exception_dates.length > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      {" "}
                      {event.exception_dates.length} off date
                      {event.exception_dates.length === 1 ? "" : "s"}{" "}
                    </p>
                  )}{" "}
                </div>{" "}
                <div className="flex gap-2">
                  {" "}
                  <button
                    onClick={() => openEdit(event)}
                    className="rounded border px-2 py-1 text-xs text-interactive hover:bg-interactive-light"
                  >
                    {" "}
                    Edit{" "}
                  </button>{" "}
                  <button
                    onClick={() => handleDelete(event.id)}
                    disabled={isPending}
                    className="rounded border border-[var(--error-border)] px-2 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)] disabled:opacity-50"
                  >
                    {" "}
                    Delete{" "}
                  </button>{" "}
                </div>{" "}
              </div>{" "}
            </div>
          ))}{" "}
        </div>
      )}{" "}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Import External School Schedule"
      >
        {" "}
        <div className="space-y-4">
          {" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Event Title
            </label>{" "}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClass}
              placeholder="Wednesday Co-op"
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Description
            </label>{" "}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={fieldClass}
              rows={2}
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Students
            </label>{" "}
            <div className="rounded-lg border border-light p-2">
              {" "}
              {children.map((child) => (
                <label
                  key={child.id}
                  className="flex items-center gap-2 py-1 text-sm text-secondary"
                >
                  {" "}
                  <input
                    type="checkbox"
                    checked={selectedChildren.includes(child.id)}
                    onChange={() => toggleChild(child.id)}
                  />{" "}
                  {child.name}{" "}
                </label>
              ))}{" "}
            </div>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                Start time
              </label>{" "}
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={fieldClass}
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                End time
              </label>{" "}
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={fieldClass}
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                Color
              </label>{" "}
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-1"
              />{" "}
            </div>{" "}
          </div>{" "}
          <label className="flex items-center gap-2 text-sm text-tertiary">
            {" "}
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
            />{" "}
            All day{" "}
          </label>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Paste dates (one per line)
            </label>{" "}
            <textarea
              value={pastedDates}
              onChange={(event) => setPastedDates(event.target.value)}
              className={fieldClass}
              rows={8}
              placeholder={"Sep 4, 2026\nSep 11, 2026\nSep 18, 2026"}
            />{" "}
          </div>{" "}
          {importPreview && (
            <div className="rounded-lg border border-light bg-surface-muted p-2 text-xs text-tertiary">
              {" "}
              {"error" in importPreview ? (
                <span className="text-red-600">{importPreview.error}</span>
              ) : (
                <>
                  {" "}
                  <p>Detected: {importPreview.recurrenceType}</p>{" "}
                  <p>
                    Range: {importPreview.startDate} to{" "}
                    {importPreview.endDate || importPreview.startDate}
                  </p>{" "}
                  <p>{importPreview.dates.length} dates pasted</p>{" "}
                  {importPreview.impliedExceptionDates.length > 0 && (
                    <p>
                      {importPreview.impliedExceptionDates.length} off dates
                      inferred
                    </p>
                  )}{" "}
                </>
              )}{" "}
            </div>
          )}{" "}
          <div className="flex justify-end gap-2">
            {" "}
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>{" "}
            <button
              onClick={handleCreate}
              disabled={
                isPending ||
                !title.trim() ||
                selectedChildren.length === 0 ||
                !pastedDates.trim()
              }
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              {isPending ? "Saving..." : "Create Event"}{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
      </Modal>{" "}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit External School Event"
      >
        {" "}
        <div className="space-y-4">
          {" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Event Title
            </label>{" "}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClass}
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Description
            </label>{" "}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={fieldClass}
              rows={2}
            />{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                Recurrence
              </label>{" "}
              <select
                value={editRecurrence}
                onChange={(event) =>
                  setEditRecurrence(
                    event.target.value as
                      | "once"
                      | "weekly"
                      | "biweekly"
                      | "monthly",
                  )
                }
                className={fieldClass}
              >
                {" "}
                <option value="once">Once</option>{" "}
                <option value="weekly">Weekly</option>{" "}
                <option value="biweekly">Biweekly</option>{" "}
                <option value="monthly">Monthly</option>{" "}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                Day of week (for weekly)
              </label>{" "}
              <select
                value={editDayOfWeek}
                onChange={(event) => setEditDayOfWeek(event.target.value)}
                className={fieldClass}
              >
                {" "}
                <option value="0">Sunday</option>{" "}
                <option value="1">Monday</option>{" "}
                <option value="2">Tuesday</option>{" "}
                <option value="3">Wednesday</option>{" "}
                <option value="4">Thursday</option>{" "}
                <option value="5">Friday</option>{" "}
                <option value="6">Saturday</option>{" "}
              </select>{" "}
            </div>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                Start date
              </label>{" "}
              <input
                type="date"
                value={editStartDate}
                onChange={(event) => setEditStartDate(event.target.value)}
                className={fieldClass}
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                End date
              </label>{" "}
              <input
                type="date"
                value={editEndDate}
                onChange={(event) => setEditEndDate(event.target.value)}
                className={fieldClass}
              />{" "}
            </div>{" "}
          </div>{" "}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                Start time
              </label>{" "}
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={fieldClass}
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                End time
              </label>{" "}
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={fieldClass}
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                Color
              </label>{" "}
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-surface px-1"
              />{" "}
            </div>{" "}
          </div>{" "}
          <label className="flex items-center gap-2 text-sm text-tertiary">
            {" "}
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
            />{" "}
            All day{" "}
          </label>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Students
            </label>{" "}
            <div className="rounded-lg border border-light p-2">
              {" "}
              {children.map((child) => (
                <label
                  key={child.id}
                  className="flex items-center gap-2 py-1 text-sm text-secondary"
                >
                  {" "}
                  <input
                    type="checkbox"
                    checked={selectedChildren.includes(child.id)}
                    onChange={() => toggleChild(child.id)}
                  />{" "}
                  {child.name}{" "}
                </label>
              ))}{" "}
            </div>{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Off dates (one per line)
            </label>{" "}
            <textarea
              value={editExceptionDates}
              onChange={(event) => setEditExceptionDates(event.target.value)}
              className={fieldClass}
              rows={5}
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Off date reason
            </label>{" "}
            <input
              value={editExceptionReason}
              onChange={(event) => setEditExceptionReason(event.target.value)}
              className={fieldClass}
            />{" "}
          </div>{" "}
          <div className="flex justify-end gap-2">
            {" "}
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>{" "}
            <button
              onClick={handleUpdate}
              disabled={
                isPending ||
                !editing ||
                !title.trim() ||
                selectedChildren.length === 0 ||
                !editStartDate
              }
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              {isPending ? "Saving..." : "Save Changes"}{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
      </Modal>{" "}
    </div>
  );
}
