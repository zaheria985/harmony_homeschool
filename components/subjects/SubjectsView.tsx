"use client";
import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import ViewToggle from "@/components/ui/ViewToggle";
import EditableCell from "@/components/ui/EditableCell";
import RowActions from "@/components/ui/RowActions";
import BulkSelectBar from "@/components/ui/BulkSelectBar";
import { updateSubject, deleteSubject } from "@/lib/actions/lessons";
type Subject = {
  id: string;
  name: string;
  color: string | null;
  thumbnail_url: string | null;
  child_ids?: string[];
  lesson_count: number;
  completed_count: number;
  curriculum_count: number;
};
type Child = { id: string; name: string };
export default function SubjectsView({
  subjects,
  children,
}: {
  subjects: Subject[];
  children: Child[];
}) {
  const router = useRouter();
  const [view, setView] = useState<string>("gallery");
  const [childFilter, setChildFilter] = useState("");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredSubjects = subjects
    .filter((subject) => {
      if (!childFilter) return true;
      return (subject.child_ids || []).includes(childFilter);
    })
    .filter((subject) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return subject.name.toLowerCase().includes(q);
    });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filteredSubjects.length) return new Set();
      return new Set(filteredSubjects.map((s) => s.id));
    });
  }, [filteredSubjects]);

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    for (const id of selectedIds) {
      await deleteSubject(id);
    }
    setIsDeleting(false);
    setSelectedIds(new Set());
    router.refresh();
  }

  const saveSubjectField = useCallback(
    (subject: Subject, field: "name" | "color" | "thumbnail_url") =>
      async (value: string) => {
        const formData = new FormData();
        formData.set("id", subject.id);
        formData.set("name", field === "name" ? value : subject.name);
        formData.set("color", field === "color" ? value : subject.color || "");
        formData.set(
          "thumbnail_url",
          field === "thumbnail_url" ? value : subject.thumbnail_url || "",
        );
        return updateSubject(formData);
      },
    [],
  );
  return (
    <>
      {" "}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {" "}
        {children.length > 0 && (
          <select
            aria-label="Filter subjects by student"
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
          >
            {" "}
            <option value="">All Students</option>{" "}
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {" "}
                {child.name}{" "}
              </option>
            ))}{" "}
          </select>
        )}{" "}
        <input
          type="text"
          aria-label="Search subjects"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects..."
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
        />{" "}
        <span className="text-sm text-muted">
          {" "}
          {filteredSubjects.length} subject
          {filteredSubjects.length !== 1 ? "s" : ""}{" "}
        </span>{" "}
        <div className="ml-auto">
          {" "}
          <ViewToggle
            storageKey="subjects-view"
            options={[
              { key: "gallery", label: "Gallery" },
              { key: "table", label: "Table" },
            ]}
            defaultView="gallery"
            onChange={setView}
          />{" "}
        </div>{" "}
      </div>{" "}
      {filteredSubjects.length === 0 && (
        <div className="py-12 text-center text-sm text-muted">
          {" "}
          <p>No subjects yet.</p>{" "}
          <p className="mt-1">Add a subject from Admin to get started.</p>{" "}
        </div>
      )}{" "}
      {filteredSubjects.length > 0 && (
        <BulkSelectBar
          selectedCount={selectedIds.size}
          totalCount={filteredSubjects.length}
          onToggleSelectAll={toggleSelectAll}
          onBulkDelete={handleBulkDelete}
          isDeleting={isDeleting}
        />
      )}
      {/* Gallery View */}{" "}
      {view === "gallery" && filteredSubjects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {" "}
          {filteredSubjects.map((subject) => {
            const pct =
              subject.lesson_count > 0
                ? Math.round(
                    (subject.completed_count / subject.lesson_count) * 100,
                  )
                : 0;
            return (
              <div
                key={subject.id}
                onClick={() => router.push(`/subjects/${subject.id}`)}
                className="group relative cursor-pointer rounded-2xl border border-light bg-surface shadow-warm transition-shadow hover:shadow-warm-md"
              >
                {/* Color bar */}{" "}
                <div
                  className="h-2 rounded-t-2xl"
                  style={{ backgroundColor: subject.color || "#6366f1" }}
                />{" "}
                {subject.thumbnail_url && (
                  <div className="aspect-[2005/880] overflow-hidden border-b border-light">
                    {" "}
                    {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
                    <img
                      src={subject.thumbnail_url}
                      alt={subject.name}
                      className="h-full w-full object-cover"
                    />{" "}
                  </div>
                )}{" "}
                <div className="p-5">
                  {" "}
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-primary">{subject.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: subject.color || "#6366f1" }} />
                      <RowActions
                        onView={() => router.push(`/subjects/${subject.id}`)}
                        onDelete={() => {
                          startTransition(async () => {
                            await deleteSubject(subject.id);
                            router.refresh();
                          });
                        }}
                        deleteWarning={`Delete "${subject.name}"? This subject has ${subject.curriculum_count} course${subject.curriculum_count === 1 ? "" : "s"}. Deleting will remove them.`}
                        disabled={isPending}
                      />
                    </div>
                  </div>{" "}
                  <div className="flex items-center justify-between text-sm">
                    {" "}
                    <span className="text-muted">
                      {" "}
                      {subject.curriculum_count} course
                      {subject.curriculum_count === 1 ? "" : "s"}{" "}
                    </span>{" "}
                    <span className="text-muted">
                      {" "}
                      {subject.completed_count}/{subject.lesson_count}{" "}
                      lessons{" "}
                    </span>{" "}
                  </div>{" "}
                  {/* Progress bar */}{" "}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-surface-subtle">
                    {" "}
                    <div
                      className="h-1.5 rounded-full bg-[var(--success-solid)]"
                      style={{ width: `${pct}%` }}
                    />{" "}
                  </div>{" "}
                </div>{" "}
              </div>
            );
          })}{" "}
        </div>
      )}{" "}
      {/* Table View */}{" "}
      {view === "table" && filteredSubjects.length > 0 && (
        <>
          {" "}
          <div className="space-y-3 md:hidden">
            {" "}
            {filteredSubjects.map((subject) => {
              const pct =
                subject.lesson_count > 0
                  ? Math.round(
                      (subject.completed_count / subject.lesson_count) * 100,
                    )
                  : 0;
              return (
                <div
                  key={subject.id}
                  className="rounded-lg border border-light bg-surface p-3 shadow-warm"
                >
                  {" "}
                  <div className="mb-2 flex items-center justify-between">
                    {" "}
                    <EditableCell
                      value={subject.name}
                      onSave={saveSubjectField(subject, "name")}
                    />{" "}
                    <div className="flex items-center gap-2">
                      <RowActions
                        onView={() => router.push(`/subjects/${subject.id}`)}
                        onDelete={() => {
                          startTransition(async () => {
                            await deleteSubject(subject.id);
                            router.refresh();
                          });
                        }}
                        deleteWarning={`Delete "${subject.name}"? This subject has ${subject.curriculum_count} course${subject.curriculum_count === 1 ? "" : "s"}. Deleting will remove them.`}
                        disabled={isPending}
                      />
                      <span
                        className="inline-block h-4 w-4 rounded-full"
                        style={{ backgroundColor: subject.color || "#6366f1" }}
                      />
                    </div>
                    {" "}
                  </div>{" "}
                  <p className="text-xs text-tertiary">
                    {" "}
                    {subject.curriculum_count} courses •{" "}
                    {subject.completed_count}/{subject.lesson_count}{" "}
                    lessons{" "}
                  </p>{" "}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-surface-subtle">
                    {" "}
                    <div
                      className="h-1.5 rounded-full bg-[var(--success-solid)]"
                      style={{ width: `${pct}%` }}
                    />{" "}
                  </div>{" "}
                </div>
              );
            })}{" "}
          </div>{" "}
          <div className="hidden overflow-x-auto rounded-lg border border-light bg-surface shadow-warm md:block">
            {" "}
            <table className="min-w-full divide-y divide-border">
              {" "}
              <thead className="bg-surface-muted">
                {" "}
                <tr>
                  {" "}
                  <th className="w-10 px-4 py-3"><input type="checkbox" checked={selectedIds.size === filteredSubjects.length && filteredSubjects.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300" aria-label="Select all" /></th>{" "}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    {" "}
                    Subject{" "}
                  </th>{" "}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    {" "}
                    Color{" "}
                  </th>{" "}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    {" "}
                    Thumbnail{" "}
                  </th>{" "}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    {" "}
                    Courses{" "}
                  </th>{" "}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    {" "}
                    Lessons{" "}
                  </th>{" "}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    {" "}
                    Progress{" "}
                  </th>{" "}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                    {" "}
                  </th>{" "}
                </tr>{" "}
              </thead>{" "}
              <tbody className="divide-y divide-border">
                {" "}
                {filteredSubjects.map((subject) => {
                  const pct =
                    subject.lesson_count > 0
                      ? Math.round(
                          (subject.completed_count / subject.lesson_count) *
                            100,
                        )
                      : 0;
                  return (
                    <tr
                      key={subject.id}
                      className="hover:bg-surface-muted"
                    >
                      {" "}
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(subject.id)} onChange={() => toggleSelect(subject.id)} className="rounded border-gray-300" aria-label={`Select ${subject.name}`} /></td>{" "}
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-primary">
                        {" "}
                        <EditableCell
                          value={subject.name}
                          onSave={saveSubjectField(subject, "name")}
                        />{" "}
                      </td>{" "}
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {" "}
                        <EditableCell
                          value={subject.color || "#6366f1"}
                          onSave={saveSubjectField(subject, "color")}
                          type="color"
                          displayValue={
                            <>
                              {" "}
                              <span
                                className="inline-block h-4 w-4 rounded-full"
                                style={{
                                  backgroundColor: subject.color || "#6366f1",
                                }}
                              />{" "}
                              <span className="sr-only">
                                Subject color indicator
                              </span>{" "}
                            </>
                          }
                        />{" "}
                      </td>{" "}
                      <td className="max-w-xs px-4 py-3 text-sm text-tertiary">
                        {" "}
                        <EditableCell
                          value={subject.thumbnail_url || ""}
                          onSave={saveSubjectField(subject, "thumbnail_url")}
                          displayValue={
                            subject.thumbnail_url ? (
                              <div className="flex items-center gap-2">
                                {" "}
                                {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
                                <img
                                  src={subject.thumbnail_url}
                                  alt={subject.name}
                                  className="h-8 w-8 rounded object-cover"
                                />{" "}
                                <span className="max-w-[16rem] truncate text-xs text-muted">
                                  {" "}
                                  {subject.thumbnail_url}{" "}
                                </span>{" "}
                              </div>
                            ) : (
                              <span className="text-muted italic">
                                Add image URL
                              </span>
                            )
                          }
                        />{" "}
                      </td>{" "}
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-tertiary">
                        {" "}
                        {subject.curriculum_count}{" "}
                      </td>{" "}
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-tertiary">
                        {" "}
                        {subject.completed_count}/{subject.lesson_count}{" "}
                      </td>{" "}
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {" "}
                        <div className="flex items-center gap-2">
                          {" "}
                          <div className="h-1.5 w-16 rounded-full bg-surface-subtle">
                            {" "}
                            <div
                              className="h-1.5 rounded-full bg-[var(--success-solid)]"
                              style={{ width: `${pct}%` }}
                            />{" "}
                          </div>{" "}
                          <span className="text-xs text-muted">
                            {pct}%
                          </span>{" "}
                        </div>{" "}
                      </td>{" "}
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <RowActions
                          onView={() => router.push(`/subjects/${subject.id}`)}
                          onDelete={() => {
                            startTransition(async () => {
                              await deleteSubject(subject.id);
                              router.refresh();
                            });
                          }}
                          deleteWarning={`Delete "${subject.name}"? This subject has ${subject.curriculum_count} course${subject.curriculum_count === 1 ? "" : "s"}. Deleting will remove them.`}
                          disabled={isPending}
                        />
                      </td>{" "}
                    </tr>
                  );
                })}{" "}
              </tbody>{" "}
            </table>{" "}
          </div>{" "}
        </>
      )}{" "}
    </>
  );
}
