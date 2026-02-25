"use client";

import { useState, useRef, useCallback, useEffect, useTransition, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import {
  updateLessonTitle,
  updateLessonStatus,
  rescheduleLesson,
  createLesson,
  bulkUpdateLessonDate,
  bulkUpdateLessonStatus,
  bulkDeleteLessons,
} from "@/lib/actions/lessons";
import { attachResourceToLessons } from "@/lib/actions/resources";

// ============================================================================
// Types
// ============================================================================

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  planned_date: string | null;
  curriculum_id: string;
  curriculum_name: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  child_id: string;
  child_name: string;
  grade: number | null;
  resource_count: number;
};

type Resource = {
  id: string;
  title: string;
  type: string;
};

type Curriculum = {
  id: string;
  name: string;
  subject_name: string;
  child_name: string;
};

// ============================================================================
// Editable Cell Components
// ============================================================================

function EditableTextCell({
  value,
  onSave,
  cellId,
  onNavigate,
}: {
  value: string;
  onSave: (val: string) => void;
  cellId: string;
  onNavigate: (dir: "next" | "prev" | "down" | "up") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      onNavigate("down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit();
      onNavigate(e.shiftKey ? "prev" : "next");
    } else if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div
        data-cell-id={cellId}
        tabIndex={0}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "F2") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        className="cursor-text rounded px-1 py-0.5 text-sm font-medium text-primary outline-none ring-focus focus:ring-2"
      >
        {value}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      data-cell-id={cellId}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className="w-full rounded border border-primary-400 px-1 py-0.5 text-sm outline-none ring-focus focus:ring-2"
    />
  );
}

function EditableDateCell({
  value,
  onSave,
  cellId,
  onNavigate,
}: {
  value: string | null;
  onSave: (val: string) => void;
  cellId: string;
  onNavigate: (dir: "next" | "prev" | "down" | "up") => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Format for display
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString()
    : "\u2014";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val && val !== value) onSave(val);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault();
      setEditing(false);
      onNavigate(e.shiftKey ? "prev" : "next");
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div
        data-cell-id={cellId}
        tabIndex={0}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "F2") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        className="cursor-pointer rounded px-1 py-0.5 text-sm text-tertiary outline-none ring-focus focus:ring-2"
      >
        {display}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="date"
      data-cell-id={cellId}
      defaultValue={value || ""}
      onChange={handleChange}
      onBlur={() => setEditing(false)}
      onKeyDown={handleKeyDown}
      className="rounded border border-primary-400 px-1 py-0.5 text-sm outline-none ring-focus focus:ring-2"
    />
  );
}

function EditableStatusCell({
  value,
  onSave,
  cellId,
  onNavigate,
}: {
  value: string;
  onSave: (val: string) => void;
  cellId: string;
  onNavigate: (dir: "next" | "prev" | "down" | "up") => void;
}) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) selectRef.current?.focus();
  }, [editing]);

  const statusVariant: Record<string, "default" | "warning" | "success"> = {
    planned: "default",
    in_progress: "warning",
    completed: "success",
  };
  const statusLabel: Record<string, string> = {
    planned: "Planned",
    in_progress: "In Progress",
    completed: "Completed",
  };

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (e.target.value !== value) onSave(e.target.value);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault();
      setEditing(false);
      onNavigate(e.shiftKey ? "prev" : "next");
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <div
        data-cell-id={cellId}
        tabIndex={0}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "F2") {
            e.preventDefault();
            setEditing(true);
          }
        }}
        className="cursor-pointer outline-none ring-focus focus:ring-2 rounded px-1 py-0.5"
      >
        <Badge variant={statusVariant[value] || "default"}>
          {statusLabel[value] || value}
        </Badge>
      </div>
    );
  }

  return (
    <select
      ref={selectRef}
      data-cell-id={cellId}
      value={value}
      onChange={handleChange}
      onBlur={() => setEditing(false)}
      onKeyDown={handleKeyDown}
      className="rounded border border-primary-400 px-1 py-0.5 text-sm outline-none ring-focus focus:ring-2"
    >
      <option value="planned">Planned</option>
      <option value="in_progress">In Progress</option>
      <option value="completed">Completed</option>
    </select>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function EditableLessonsTable({
  lessons: initialLessons,
  resources,
  curricula,
}: {
  lessons: Lesson[];
  resources: Resource[];
  curricula: Curriculum[];
}) {
  const [lessons, setLessons] = useState(initialLessons);
  const [isPending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [childFilter, setChildFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [curriculumFilter, setCurriculumFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showBulkDateModal, setShowBulkDateModal] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteTargetCurriculum, setPasteTargetCurriculum] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkStatus, setBulkStatus] = useState("planned");
  const [toast, setToast] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  // Sync with server data
  useEffect(() => {
    setLessons(initialLessons);
  }, [initialLessons]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ============================================================================
  // Filter options & filtered data
  // ============================================================================

  const childOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of initialLessons) map.set(l.child_id, l.child_name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [initialLessons]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of initialLessons) map.set(l.subject_id, l.subject_name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [initialLessons]);

  const curriculumOptions = useMemo(() => {
    const map = new Map<string, { name: string; subject_id: string }>();
    for (const l of initialLessons) map.set(l.curriculum_id, { name: l.curriculum_name, subject_id: l.subject_id });
    let opts = Array.from(map, ([id, v]) => ({ id, name: v.name, subject_id: v.subject_id }));
    if (subjectFilter) opts = opts.filter(o => o.subject_id === subjectFilter);
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [initialLessons, subjectFilter]);

  const filteredLessons = useMemo(() => {
    let result = lessons;
    if (childFilter) result = result.filter(l => l.child_id === childFilter);
    if (subjectFilter) result = result.filter(l => l.subject_id === subjectFilter);
    if (curriculumFilter) result = result.filter(l => l.curriculum_id === curriculumFilter);
    if (statusFilter) result = result.filter(l => l.status === statusFilter);
    if (dateFrom) result = result.filter(l => l.planned_date && l.planned_date >= dateFrom);
    if (dateTo) result = result.filter(l => l.planned_date && l.planned_date <= dateTo);
    return result;
  }, [lessons, childFilter, subjectFilter, curriculumFilter, statusFilter, dateFrom, dateTo]);

  // Reset row selection when filters change
  useEffect(() => {
    setRowSelection({});
  }, [childFilter, subjectFilter, curriculumFilter, statusFilter, dateFrom, dateTo]);

  // ============================================================================
  // Cell navigation
  // ============================================================================

  const navigateCell = useCallback(
    (currentCellId: string, dir: "next" | "prev" | "down" | "up") => {
      const editableColumns = ["title", "planned_date", "status"];
      // cellId format: "row-col" e.g. "3-title"
      const [rowStr, col] = currentCellId.split("-");
      const rowIdx = parseInt(rowStr);
      const colIdx = editableColumns.indexOf(col);
      if (colIdx === -1) return;

      let nextRow = rowIdx;
      let nextCol = colIdx;

      if (dir === "next") {
        nextCol = colIdx + 1;
        if (nextCol >= editableColumns.length) {
          nextCol = 0;
          nextRow = rowIdx + 1;
        }
      } else if (dir === "prev") {
        nextCol = colIdx - 1;
        if (nextCol < 0) {
          nextCol = editableColumns.length - 1;
          nextRow = rowIdx - 1;
        }
      } else if (dir === "down") {
        nextRow = rowIdx + 1;
      } else if (dir === "up") {
        nextRow = rowIdx - 1;
      }

      const nextCellId = `${nextRow}-${editableColumns[nextCol]}`;
      const el = tableRef.current?.querySelector(
        `[data-cell-id="${nextCellId}"]`,
      ) as HTMLElement | null;
      el?.focus();
    },
    [],
  );

  // ============================================================================
  // Actions
  // ============================================================================

  function optimisticUpdate(id: string, field: string, value: string | null) {
    setLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    );
  }

  function handleTitleSave(id: string, curriculumId: string, title: string) {
    optimisticUpdate(id, "title", title);
    startTransition(async () => {
      const result = await updateLessonTitle(id, title);
      if (result.error) setToast("Failed to save title");
      else setToast("Title saved");
    });
  }

  function handleDateSave(id: string, date: string) {
    optimisticUpdate(id, "planned_date", date);
    startTransition(async () => {
      const result = await rescheduleLesson(id, date);
      if (result.error) setToast("Failed to save date");
      else setToast("Date saved");
    });
  }

  function handleStatusSave(id: string, status: string) {
    optimisticUpdate(id, "status", status);
    startTransition(async () => {
      const result = await updateLessonStatus(id, status);
      if (result.error) setToast("Failed to save status");
      else setToast("Status saved");
    });
  }

  // ============================================================================
  // Bulk operations
  // ============================================================================

  const selectedIds = Object.keys(rowSelection)
    .filter((k) => rowSelection[k])
    .map((idx) => filteredLessons[parseInt(idx)]?.id)
    .filter(Boolean) as string[];

  function handleBulkAttach() {
    if (selectedResources.length === 0 || selectedIds.length === 0) return;
    startTransition(async () => {
      for (const resourceId of selectedResources) {
        await attachResourceToLessons(resourceId, selectedIds);
      }
      setShowAttachModal(false);
      setSelectedResources([]);
      setResourceSearch("");
      setRowSelection({});
      setToast(`Attached ${selectedResources.length} resource(s)`);
    });
  }

  function handleBulkDate() {
    if (!bulkDate || selectedIds.length === 0) return;
    // Optimistic
    setLessons((prev) =>
      prev.map((l) =>
        selectedIds.includes(l.id) ? { ...l, planned_date: bulkDate } : l,
      ),
    );
    startTransition(async () => {
      const result = await bulkUpdateLessonDate(selectedIds, bulkDate);
      if (result.error) setToast("Failed to update dates");
      else setToast(`Updated ${selectedIds.length} date(s)`);
      setShowBulkDateModal(false);
      setBulkDate("");
      setRowSelection({});
    });
  }

  function handleBulkStatus() {
    if (selectedIds.length === 0) return;
    setLessons((prev) =>
      prev.map((l) =>
        selectedIds.includes(l.id) ? { ...l, status: bulkStatus } : l,
      ),
    );
    startTransition(async () => {
      const result = await bulkUpdateLessonStatus(selectedIds, bulkStatus);
      if (result.error) setToast("Failed to update statuses");
      else setToast(`Updated ${selectedIds.length} status(es)`);
      setShowBulkStatusModal(false);
      setBulkStatus("planned");
      setRowSelection({});
    });
  }

  function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    setLessons((prev) => prev.filter((l) => !selectedIds.includes(l.id)));
    startTransition(async () => {
      const result = await bulkDeleteLessons(selectedIds);
      if (result.error) setToast("Failed to delete lessons");
      else setToast(`Deleted ${selectedIds.length} lesson(s)`);
      setShowBulkDeleteConfirm(false);
      setRowSelection({});
    });
  }

  // ============================================================================
  // Bulk paste
  // ============================================================================

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text/plain");
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length <= 1) return; // let single-line paste go through normally

    e.preventDefault();
    // Multiple lines → open paste modal to pick curriculum
    setPastedLines(lines);
    setShowPasteModal(true);
  }

  const [pastedLines, setPastedLines] = useState<string[]>([]);

  function handlePasteConfirm() {
    if (!pasteTargetCurriculum || pastedLines.length === 0) return;
    startTransition(async () => {
      let created = 0;
      for (const line of pastedLines) {
        // Parse tab-separated: title \t date (optional)
        const parts = line.split("\t");
        const title = parts[0]?.trim();
        if (!title) continue;
        const date = parts[1]?.trim();

        const fd = new FormData();
        fd.set("title", title);
        fd.set("curriculum_id", pasteTargetCurriculum);
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          fd.set("planned_date", date);
        }
        const result = await createLesson(fd);
        if (result.success) created++;
      }
      setShowPasteModal(false);
      setPastedLines([]);
      setPasteTargetCurriculum("");
      setToast(`Created ${created} lesson(s)`);
    });
  }

  // ============================================================================
  // Column definitions
  // ============================================================================

  const columns: ColumnDef<Lesson>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="rounded border-border text-interactive focus:ring-focus"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-border text-interactive focus:ring-focus"
        />
      ),
      size: 40,
      enableSorting: false,
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row, table }) => {
        const rowIdx = table.getSortedRowModel().rows.indexOf(row);
        return (
          <EditableTextCell
            value={row.original.title}
            cellId={`${rowIdx}-title`}
            onSave={(val) =>
              handleTitleSave(row.original.id, row.original.curriculum_id, val)
            }
            onNavigate={(dir) => navigateCell(`${rowIdx}-title`, dir)}
          />
        );
      },
      size: 280,
    },
    {
      accessorKey: "child_name",
      header: "Student",
      cell: ({ getValue }) => (
        <span className="text-sm text-tertiary">{getValue() as string}</span>
      ),
      size: 100,
      enableSorting: true,
    },
    {
      accessorKey: "subject_name",
      header: "Subject",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: row.original.subject_color }}
          />
          <span className="text-sm text-secondary">
            {row.original.subject_name}
          </span>
        </div>
      ),
      size: 120,
      enableSorting: true,
    },
    {
      accessorKey: "curriculum_name",
      header: "Curriculum",
      cell: ({ getValue }) => (
        <span className="text-sm text-tertiary truncate block max-w-[150px]">
          {getValue() as string}
        </span>
      ),
      size: 150,
      enableSorting: true,
    },
    {
      accessorKey: "planned_date",
      header: "Due Date",
      cell: ({ row, table }) => {
        const rowIdx = table.getSortedRowModel().rows.indexOf(row);
        return (
          <EditableDateCell
            value={row.original.planned_date}
            cellId={`${rowIdx}-planned_date`}
            onSave={(val) => handleDateSave(row.original.id, val)}
            onNavigate={(dir) => navigateCell(`${rowIdx}-planned_date`, dir)}
          />
        );
      },
      size: 130,
      sortingFn: (a, b) => {
        const da = a.original.planned_date;
        const db = b.original.planned_date;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.localeCompare(db);
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row, table }) => {
        const rowIdx = table.getSortedRowModel().rows.indexOf(row);
        return (
          <EditableStatusCell
            value={row.original.status}
            cellId={`${rowIdx}-status`}
            onSave={(val) => handleStatusSave(row.original.id, val)}
            onNavigate={(dir) => navigateCell(`${rowIdx}-status`, dir)}
          />
        );
      },
      size: 120,
    },
    {
      accessorKey: "resource_count",
      header: "Resources",
      cell: ({ row }) => (
        <span className="text-sm text-muted">
          {row.original.resource_count > 0 ? (
            <span className="rounded-full bg-interactive-light px-2 py-0.5 text-xs font-medium text-interactive-hover">
              {row.original.resource_count}
            </span>
          ) : (
            <span className="text-border">\u2014</span>
          )}
        </span>
      ),
      size: 80,
      enableSorting: true,
    },
  ];

  // ============================================================================
  // Table instance
  // ============================================================================

  const table = useReactTable({
    data: filteredLessons,
    columns,
    state: { sorting, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      return (
        row.original.title.toLowerCase().includes(search) ||
        row.original.child_name.toLowerCase().includes(search) ||
        row.original.subject_name.toLowerCase().includes(search) ||
        row.original.curriculum_name.toLowerCase().includes(search)
      );
    },
  });

  const filteredResources = resources.filter(
    (r) =>
      !resourceSearch ||
      r.title.toLowerCase().includes(resourceSearch.toLowerCase()),
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={childFilter} onChange={(e) => setChildFilter(e.target.value)}
          className="rounded-lg border border-light bg-surface px-3 py-2 text-sm">
          <option value="">All Students</option>
          {childOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setCurriculumFilter(""); }}
          className="rounded-lg border border-light bg-surface px-3 py-2 text-sm">
          <option value="">All Subjects</option>
          {subjectOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={curriculumFilter} onChange={(e) => setCurriculumFilter(e.target.value)}
          className="rounded-lg border border-light bg-surface px-3 py-2 text-sm">
          <option value="">All Courses</option>
          {curriculumOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-light bg-surface px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          title="From date"
          className="rounded-lg border border-light bg-surface px-3 py-2 text-sm" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          title="To date"
          className="rounded-lg border border-light bg-surface px-3 py-2 text-sm" />
        {(childFilter || subjectFilter || curriculumFilter || statusFilter || dateFrom || dateTo) && (
          <button type="button" onClick={() => { setChildFilter(""); setSubjectFilter(""); setCurriculumFilter(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); }}
            className="text-xs font-medium text-interactive hover:underline">
            Clear filters
          </button>
        )}
        <input
          type="text"
          placeholder="Search lessons..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
        />
        <span className="text-sm text-muted">
          {table.getFilteredRowModel().rows.length} lesson
          {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
        </span>

        {/* Bulk actions */}
        {selectedIds.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm font-medium text-interactive-hover">
              {selectedIds.length} selected
            </span>
            <button
              onClick={() => setShowBulkDateModal(true)}
              className="rounded-lg border border-interactive-border px-3 py-1.5 text-xs font-medium text-interactive-hover hover:bg-interactive-light"
            >
              Set Date
            </button>
            <button
              onClick={() => setShowBulkStatusModal(true)}
              className="rounded-lg border border-interactive-border px-3 py-1.5 text-xs font-medium text-interactive-hover hover:bg-interactive-light"
            >
              Set Status
            </button>
            <button
              onClick={() => setShowAttachModal(true)}
              className="rounded-lg border border-interactive-border px-3 py-1.5 text-xs font-medium text-interactive-hover hover:bg-interactive-light"
            >
              Attach Resources
            </button>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="rounded-lg border border-[var(--error-border)] px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-[var(--error-bg)]"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Paste hint */}
      <p className="mb-2 text-xs text-muted">
        Double-click or press Enter to edit cells. Tab to move between cells.
        Paste multiple lines to bulk-create lessons.
      </p>

      {/* Saving indicator */}
      {isPending && (
        <div className="mb-2 text-xs text-interactive animate-pulse">
          Saving...
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="mb-2 rounded-lg bg-[var(--success-bg)] px-3 py-1.5 text-xs font-medium text-[var(--success-text)]">
          {toast}
        </div>
      )}

      {/* Table */}
      <div
        ref={tableRef}
        onPaste={handlePaste}
        className="overflow-x-auto rounded-2xl border border-light bg-surface shadow-warm"
      >
        <table className="w-full text-left">
          <thead className="border-b bg-surface-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.getSize() }}
                    className={`px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted ${
                      header.column.getCanSort()
                        ? "cursor-pointer select-none hover:text-secondary"
                        : ""
                    }`}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {header.column.getIsSorted() === "asc"
                      ? " \u2191"
                      : header.column.getIsSorted() === "desc"
                        ? " \u2193"
                        : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`${
                  row.getIsSelected()
                    ? "bg-interactive-light"
                    : "hover:bg-surface-muted"
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="px-3 py-2"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-muted"
                >
                  No lessons found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ================================================================ */}
      {/* Attach Resources Modal */}
      {/* ================================================================ */}
      <Modal
        open={showAttachModal}
        onClose={() => {
          setShowAttachModal(false);
          setSelectedResources([]);
          setResourceSearch("");
        }}
        title={`Attach Resources to ${selectedIds.length} Lesson(s)`}
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search resources..."
            value={resourceSearch}
            onChange={(e) => setResourceSearch(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filteredResources.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">
                No resources found
              </p>
            ) : (
              filteredResources.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface-muted"
                >
                  <input
                    type="checkbox"
                    checked={selectedResources.includes(r.id)}
                    onChange={() =>
                      setSelectedResources((prev) =>
                        prev.includes(r.id)
                          ? prev.filter((x) => x !== r.id)
                          : [...prev, r.id],
                      )
                    }
                    className="rounded border-border text-interactive focus:ring-focus"
                  />
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {r.title}
                    </p>
                    <p className="text-xs text-muted">{r.type}</p>
                  </div>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAttachModal(false);
                setSelectedResources([]);
              }}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkAttach}
              disabled={isPending || selectedResources.length === 0}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {isPending
                ? "Attaching..."
                : `Attach (${selectedResources.length})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* ================================================================ */}
      {/* Bulk Date Modal */}
      {/* ================================================================ */}
      <Modal
        open={showBulkDateModal}
        onClose={() => setShowBulkDateModal(false)}
        title={`Set Date for ${selectedIds.length} Lesson(s)`}
      >
        <div className="space-y-4">
          <input
            type="date"
            value={bulkDate}
            onChange={(e) => setBulkDate(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBulkDateModal(false)}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDate}
              disabled={isPending || !bulkDate}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {isPending ? "Updating..." : "Apply"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ================================================================ */}
      {/* Bulk Status Modal */}
      {/* ================================================================ */}
      <Modal
        open={showBulkStatusModal}
        onClose={() => setShowBulkStatusModal(false)}
        title={`Set Status for ${selectedIds.length} Lesson(s)`}
      >
        <div className="space-y-4">
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          >
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBulkStatusModal(false)}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkStatus}
              disabled={isPending}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {isPending ? "Updating..." : "Apply"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ================================================================ */}
      {/* Bulk Delete Confirmation */}
      {/* ================================================================ */}
      <Modal
        open={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        title={`Delete ${selectedIds.length} Lesson(s)`}
      >
        <p className="mb-2 text-sm text-tertiary">
          Are you sure you want to delete <strong>{selectedIds.length}</strong>{" "}
          lesson{selectedIds.length === 1 ? "" : "s"}?
        </p>
        <p className="mb-4 text-sm text-red-600">
          This will permanently delete the lessons and any associated completions.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowBulkDeleteConfirm(false)}
            className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>

      {/* ================================================================ */}
      {/* Paste Modal */}
      {/* ================================================================ */}
      <Modal
        open={showPasteModal}
        onClose={() => {
          setShowPasteModal(false);
          setPastedLines([]);
        }}
        title={`Bulk Create ${pastedLines.length} Lesson(s)`}
      >
        <div className="space-y-4">
          <p className="text-sm text-tertiary">
            {pastedLines.length} lines detected. Choose a curriculum to create
            them under:
          </p>
          <select
            value={pasteTargetCurriculum}
            onChange={(e) => setPasteTargetCurriculum(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          >
            <option value="">Select curriculum...</option>
            {curricula.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.subject_name} - {c.child_name})
              </option>
            ))}
          </select>
          <div className="max-h-40 overflow-y-auto rounded-lg border bg-surface-muted p-3">
            <ul className="space-y-1 text-xs text-secondary">
              {pastedLines.map((line, i) => (
                <li key={i} className="truncate">
                  {i + 1}. {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowPasteModal(false);
                setPastedLines([]);
              }}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              onClick={handlePasteConfirm}
              disabled={isPending || !pasteTargetCurriculum}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {isPending
                ? "Creating..."
                : `Create ${pastedLines.length} Lessons`}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
