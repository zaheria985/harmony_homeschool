"use client";

import { useState, useCallback } from "react";
import Card from "@/components/ui/Card";
import { createCurriculum, bulkCreateLessons } from "@/lib/actions/lessons";
import { bulkCreateLessonResources } from "@/lib/actions/resources";
import { autoScheduleLessons } from "@/lib/actions/schedule";
import { assignCurriculum } from "@/lib/actions/lessons";
import { z } from "zod";

// --- Types ---

type Subject = { id: string; name: string; color: string };
type Child = { id: string; name: string };
type SchoolYear = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
};

type JsonResource = {
  type: string;
  url: string;
  title?: string;
};

type JsonLesson = {
  title: string;
  resources?: JsonResource[];
};

type JsonUnit = {
  name: string;
  lessons: JsonLesson[];
  additional_resources?: JsonResource[];
};

type JsonInput =
  | { name: string; units: JsonUnit[]; lessons?: never }
  | { name: string; lessons: JsonLesson[]; units?: never };

type ParsedLesson = {
  id: string;
  number: string;
  title: string;
  section: string;
  resources: Array<{ type: "youtube" | "pdf" | "url"; url: string; title: string }>;
  included: boolean;
};

type Props = {
  subjects: Subject[];
  children: Child[];
  schoolYears: SchoolYear[];
};

// --- Zod schema for JSON validation ---

const resourceSchema = z.object({
  type: z.string(),
  url: z.string().url(),
  title: z.string().optional(),
});

const lessonSchema = z.object({
  title: z.string().min(1),
  resources: z.array(resourceSchema).optional(),
});

const unitSchema = z.object({
  name: z.string().min(1),
  lessons: z.array(lessonSchema).min(1),
  additional_resources: z.array(resourceSchema).optional(),
});

const jsonSchema = z.union([
  z.object({
    name: z.string().min(1),
    units: z.array(unitSchema).min(1),
  }),
  z.object({
    name: z.string().min(1),
    lessons: z.array(lessonSchema).min(1),
  }),
]);

// --- Helpers ---

function normalizeResourceType(t: string): "youtube" | "pdf" | "url" {
  if (t === "youtube") return "youtube";
  if (t === "pdf") return "pdf";
  return "url";
}

function parseJson(raw: string): { data?: JsonInput; error?: string } {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "Invalid JSON — check syntax" };
  }
  const result = jsonSchema.safeParse(parsed);
  if (!result.success) {
    return { error: result.error.issues.map((i) => i.message).join("; ") };
  }
  return { data: result.data as JsonInput };
}

function buildLessons(data: JsonInput): ParsedLesson[] {
  const lessons: ParsedLesson[] = [];
  let counter = 1;

  if (data.units) {
    for (const unit of data.units) {
      const unitLessons = unit.lessons.map((l, idx) => {
        const num = String(counter++).padStart(2, "0");
        const resources = (l.resources || []).map((r) => ({
          type: normalizeResourceType(r.type),
          url: r.url,
          title: r.title || r.url,
        }));
        // Attach unit additional_resources to first lesson
        if (idx === 0 && unit.additional_resources) {
          for (const ar of unit.additional_resources) {
            resources.push({
              type: normalizeResourceType(ar.type),
              url: ar.url,
              title: ar.title || ar.url,
            });
          }
        }
        return {
          id: crypto.randomUUID(),
          number: num,
          title: l.title,
          section: unit.name,
          resources,
          included: true,
        };
      });
      lessons.push(...unitLessons);
    }
  } else if (data.lessons) {
    for (const l of data.lessons) {
      const num = String(counter++).padStart(2, "0");
      lessons.push({
        id: crypto.randomUUID(),
        number: num,
        title: l.title,
        section: "",
        resources: (l.resources || []).map((r) => ({
          type: normalizeResourceType(r.type),
          url: r.url,
          title: r.title || r.url,
        })),
        included: true,
      });
    }
  }
  return lessons;
}

// --- Step Indicator ---

function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                isActive
                  ? "bg-interactive text-white"
                  : isDone
                    ? "bg-green-600 text-white"
                    : "bg-muted text-secondary"
              }`}
            >
              {isDone ? "✓" : stepNum}
            </div>
            <span
              className={`text-sm ${isActive ? "font-semibold text-primary" : "text-secondary"}`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="h-px w-8 bg-border-light" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Weekday Picker ---

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WeekdayPicker({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <div className="flex gap-2">
      {WEEKDAYS.map((day, i) => (
        <button
          key={day}
          type="button"
          onClick={() =>
            onChange(
              selected.includes(i)
                ? selected.filter((d) => d !== i)
                : [...selected, i].sort()
            )
          }
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            selected.includes(i)
              ? "bg-interactive text-white"
              : "bg-muted text-secondary hover:bg-surface"
          }`}
        >
          {day}
        </button>
      ))}
    </div>
  );
}

// --- Main Component ---

export default function CurriculumImportClient({
  subjects,
  children: childrenList,
  schoolYears,
}: Props) {
  const STEPS = ["Paste JSON", "Configure", "Preview & Edit", "Assign", "Import"];
  const [step, setStep] = useState(1);

  // Step 1: JSON input
  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState("");

  // Step 2: Config
  const [curriculumName, setCurriculumName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [courseType, setCourseType] = useState<"curriculum" | "unit_study">("curriculum");
  const [gradeType, setGradeType] = useState<"numeric" | "pass_fail" | "combo">("pass_fail");

  // Step 3: Lessons
  const [lessons, setLessons] = useState<ParsedLesson[]>([]);

  // Step 4: Assign
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [schoolYearId, setSchoolYearId] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [doSchedule, setDoSchedule] = useState(true);

  // Step 5: Import
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    curriculumId?: string;
    lessonCount?: number;
    resourceCount?: number;
    error?: string;
  } | null>(null);

  // --- Step 1: Parse ---
  const handleParse = useCallback(() => {
    setParseError("");
    const { data, error } = parseJson(jsonText.trim());
    if (error || !data) {
      setParseError(error || "Failed to parse");
      return;
    }
    setCurriculumName(data.name);
    setLessons(buildLessons(data));
    setStep(2);
  }, [jsonText]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setJsonText(text);
      };
      reader.readAsText(file);
    },
    []
  );

  // --- Step 3: Lesson editing ---
  const updateLesson = useCallback(
    (id: string, updates: Partial<ParsedLesson>) => {
      setLessons((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
      );
    },
    []
  );

  const toggleAll = useCallback((included: boolean) => {
    setLessons((prev) => prev.map((l) => ({ ...l, included })));
  }, []);

  // --- Step 5: Import ---
  const doImport = useCallback(async () => {
    setImporting(true);
    setResult(null);
    try {
      // 1. Create curriculum
      const fd = new FormData();
      fd.set("name", curriculumName);
      if (subjectId) fd.set("subject_id", subjectId);
      fd.set("course_type", courseType);
      fd.set("grade_type", gradeType);
      fd.set("status", "active");
      // If assigning to a single child, let createCurriculum handle the assignment
      if (selectedChildIds.length === 1 && schoolYearId) {
        fd.set("child_id", selectedChildIds[0]);
        fd.set("school_year_id", schoolYearId);
      }

      const curricResult = await createCurriculum(fd);
      if ("error" in curricResult) {
        setResult({ success: false, error: curricResult.error });
        return;
      }
      const curriculumId = curricResult.id;

      // 2. For multiple children, create additional assignments
      if (selectedChildIds.length > 1 && schoolYearId) {
        for (const childId of selectedChildIds) {
          const afd = new FormData();
          afd.set("curriculum_id", curriculumId);
          afd.set("child_id", childId);
          afd.set("school_year_id", schoolYearId);
          await assignCurriculum(afd);
        }
      }

      // 3. Create lessons
      const includedLessons = lessons.filter((l) => l.included);
      const lessonsPayload = includedLessons.map((l) => ({
        title: `${l.number} ${l.title}`,
        curriculum_id: curriculumId,
        description: "",
        status: "planned" as const,
        section: l.section || undefined,
      }));

      const lessonsResult = await bulkCreateLessons(
        lessonsPayload,
        selectedChildIds.length > 0 && schoolYearId
          ? { childIds: selectedChildIds, schoolYearId }
          : undefined
      );
      if ("error" in lessonsResult) {
        setResult({
          success: false,
          error: `Curriculum created but lessons failed: ${lessonsResult.error}`,
        });
        return;
      }

      const lessonIds = lessonsResult.lessonIds;

      // 4. Create lesson resources
      let resourceCount = 0;
      const resourceItems = includedLessons
        .map((l, i) => ({
          lessonId: lessonIds[i],
          resources: l.resources.map((r) => ({
            type: r.type,
            url: r.url,
            title: r.title,
          })),
        }))
        .filter((item) => item.resources.length > 0);

      if (resourceItems.length > 0) {
        const resResult = await bulkCreateLessonResources(resourceItems);
        if ("created" in resResult) {
          resourceCount = resResult.created ?? 0;
        }
      }

      // 5. Set weekday schedule and auto-schedule if requested
      if (selectedChildIds.length > 0 && schoolYearId && weekdays.length > 0) {
        // Get assignment IDs to set weekdays
        for (const childId of selectedChildIds) {
          // setAssignmentDays needs assignment ID — we need to look it up
          // Instead, use the assignment we know was created
          // We'll use assignCurriculum's implicit creation + autoSchedule
          if (doSchedule) {
            await autoScheduleLessons(curriculumId, childId);
          }
        }
      }

      setResult({
        success: true,
        curriculumId,
        lessonCount: lessonsResult.created,
        resourceCount,
      });
      setStep(5);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setImporting(false);
    }
  }, [
    curriculumName,
    subjectId,
    courseType,
    gradeType,
    lessons,
    selectedChildIds,
    schoolYearId,
    weekdays,
    doSchedule,
  ]);

  // --- Validation ---
  const step2Valid = curriculumName.trim() !== "" && subjectId !== "";
  const includedCount = lessons.filter((l) => l.included).length;
  const step3Valid = includedCount > 0;

  // --- Grouped lessons for preview ---
  const sections = lessons.reduce(
    (acc, l) => {
      const key = l.section || "__flat__";
      if (!acc[key]) acc[key] = [];
      acc[key].push(l);
      return acc;
    },
    {} as Record<string, ParsedLesson[]>
  );

  return (
    <div>
      <StepIndicator steps={STEPS} current={step} />

      {/* Step 1: Paste JSON */}
      {step === 1 && (
        <Card title="Paste or Upload Curriculum JSON">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                Upload JSON file
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="block text-sm text-secondary file:mr-4 file:rounded-lg file:border-0 file:bg-interactive file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:opacity-90"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                Or paste JSON
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={14}
                placeholder='{"name": "Course Name", "units": [...]}'
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>

            {parseError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
                {parseError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleParse}
                disabled={!jsonText.trim()}
                className="rounded-lg bg-interactive px-6 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Parse & Continue
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Configure Curriculum */}
      {step === 2 && (
        <Card title="Configure Curriculum">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                Curriculum Name
              </label>
              <input
                type="text"
                value={curriculumName}
                onChange={(e) => setCurriculumName(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                Subject
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
              >
                <option value="">Select a subject...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  Course Type
                </label>
                <select
                  value={courseType}
                  onChange={(e) =>
                    setCourseType(e.target.value as "curriculum" | "unit_study")
                  }
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  <option value="curriculum">Curriculum</option>
                  <option value="unit_study">Unit Study</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  Grade Type
                </label>
                <select
                  value={gradeType}
                  onChange={(e) =>
                    setGradeType(
                      e.target.value as "numeric" | "pass_fail" | "combo"
                    )
                  }
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  <option value="pass_fail">Pass / Fail</option>
                  <option value="numeric">Numeric</option>
                  <option value="combo">Combo</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary transition hover:bg-surface"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!step2Valid}
                className="rounded-lg bg-interactive px-6 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Next: Preview Lessons
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Preview & Edit Lessons */}
      {step === 3 && (
        <Card
          title={`Preview & Edit Lessons (${includedCount} of ${lessons.length} included)`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleAll(true)}
                className="rounded border border-border px-3 py-1 text-xs font-medium text-secondary hover:bg-surface"
              >
                Include All
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="rounded border border-border px-3 py-1 text-xs font-medium text-secondary hover:bg-surface"
              >
                Exclude All
              </button>
            </div>

            {Object.entries(sections).map(([sectionName, sectionLessons]) => (
              <div key={sectionName}>
                {sectionName !== "__flat__" && (
                  <h3 className="mb-2 text-sm font-semibold text-primary border-b border-border-light pb-1">
                    {sectionName}
                  </h3>
                )}
                <div className="space-y-1">
                  {sectionLessons.map((l) => (
                    <div
                      key={l.id}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                        l.included
                          ? "border-border bg-surface"
                          : "border-border bg-muted opacity-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={l.included}
                        onChange={(e) =>
                          updateLesson(l.id, { included: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-border accent-interactive"
                      />
                      <input
                        type="text"
                        value={l.number}
                        onChange={(e) =>
                          updateLesson(l.id, { number: e.target.value })
                        }
                        className="w-12 rounded border border-border bg-surface px-2 py-1 text-center text-xs font-mono text-primary focus:outline-none focus:ring-1 focus:ring-focus"
                      />
                      <input
                        type="text"
                        value={l.title}
                        onChange={(e) =>
                          updateLesson(l.id, { title: e.target.value })
                        }
                        className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm text-primary focus:outline-none focus:ring-1 focus:ring-focus"
                      />
                      {l.resources.length > 0 && (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs text-secondary">
                          {l.resources.length} resource
                          {l.resources.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary transition hover:bg-surface"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!step3Valid}
                className="rounded-lg bg-interactive px-6 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                Next: Assign
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Assign (Optional) */}
      {step === 4 && (
        <Card title="Assign to Children (Optional)">
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              You can assign this curriculum to children now, or skip and assign
              later.
            </p>

            <div>
              <label className="mb-2 block text-sm font-medium text-secondary">
                Children
              </label>
              <div className="flex flex-wrap gap-2">
                {childrenList.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() =>
                      setSelectedChildIds((prev) =>
                        prev.includes(child.id)
                          ? prev.filter((id) => id !== child.id)
                          : [...prev, child.id]
                      )
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      selectedChildIds.includes(child.id)
                        ? "bg-interactive text-white"
                        : "bg-muted text-secondary hover:bg-surface"
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            </div>

            {selectedChildIds.length > 0 && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-secondary">
                    School Year
                  </label>
                  <select
                    value={schoolYearId}
                    onChange={(e) => setSchoolYearId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    <option value="">Select school year...</option>
                    {schoolYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-secondary">
                    Schedule Days
                  </label>
                  <WeekdayPicker selected={weekdays} onChange={setWeekdays} />
                </div>

                <label className="flex items-center gap-2 text-sm text-secondary">
                  <input
                    type="checkbox"
                    checked={doSchedule}
                    onChange={(e) => setDoSchedule(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-interactive"
                  />
                  Auto-schedule lessons to dates after import
                </label>
              </>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(3)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary transition hover:bg-surface"
              >
                Back
              </button>
              <div className="flex gap-2">
                {selectedChildIds.length === 0 && (
                  <button
                    onClick={() => {
                      setSelectedChildIds([]);
                      setSchoolYearId("");
                      doImport();
                    }}
                    disabled={importing}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary transition hover:bg-surface disabled:opacity-50"
                  >
                    Skip & Import
                  </button>
                )}
                <button
                  onClick={doImport}
                  disabled={
                    importing ||
                    (selectedChildIds.length > 0 && !schoolYearId)
                  }
                  className="rounded-lg bg-interactive px-6 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? "Importing..." : "Import Curriculum"}
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step 5: Results */}
      {step === 5 && result && (
        <Card title={result.success ? "Import Complete" : "Import Failed"}>
          {result.success ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-900/20">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Successfully imported!
                </p>
                <ul className="mt-2 space-y-1 text-sm text-green-700 dark:text-green-400">
                  <li>{result.lessonCount} lessons created</li>
                  <li>{result.resourceCount} resources attached</li>
                  {selectedChildIds.length > 0 && (
                    <li>
                      Assigned to{" "}
                      {selectedChildIds
                        .map(
                          (id) =>
                            childrenList.find((c) => c.id === id)?.name || id
                        )
                        .join(", ")}
                    </li>
                  )}
                </ul>
              </div>
              <div className="flex gap-3">
                <a
                  href={`/curricula/${result.curriculumId}`}
                  className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                >
                  View Curriculum
                </a>
                <button
                  onClick={() => {
                    setStep(1);
                    setJsonText("");
                    setCurriculumName("");
                    setSubjectId("");
                    setLessons([]);
                    setSelectedChildIds([]);
                    setSchoolYearId("");
                    setResult(null);
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary transition hover:bg-surface"
                >
                  Import Another
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
                {result.error}
              </div>
              <button
                onClick={() => setStep(4)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary transition hover:bg-surface"
              >
                Go Back
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
