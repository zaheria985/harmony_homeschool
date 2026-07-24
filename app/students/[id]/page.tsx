export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FileText, Award, ClipboardList, Flame, BookOpen, CalendarCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SchoolYearSelector from "@/components/students/SchoolYearSelector";
import StudentTabs, {
  parseStudentTab,
} from "@/components/students/StudentTabs";
import YearOverYearChart from "@/components/students/YearOverYearChart";
import GradesTableClient from "@/components/grades/GradesTableClient";
import {
  getActiveSchoolYear,
  getChildById,
  getChildProgress,
  getChildSubjects,
  getCompletedCurricula,
  getChildRoster,
  getYearOverYearProgress,
} from "@/lib/queries/students";
import { getGradesByChild, getGradeSummary } from "@/lib/queries/grades";
import { getReadingLog, getReadingStats } from "@/lib/queries/reading";
import { getAttendanceSummary } from "@/lib/queries/attendance";
import { getCompletionStreaks } from "@/lib/queries/streaks";
import { getDefaultScaleThresholds } from "@/lib/actions/grades";
import { getAllSchoolYearsForReports } from "@/lib/queries/reports";
import { getLetterGrade } from "@/lib/utils/grading";
import { kidColorFor } from "@/lib/utils/kid-colors";
import { todayKey } from "@/lib/utils/timezone";

type Row = Record<string, string | number | null>;

export default async function StudentHubPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { yearId?: string; tab?: string };
}) {
  const child = await getChildById(params.id);
  if (!child) notFound();

  const tab = parseStudentTab(searchParams.tab);
  const schoolYears = await getAllSchoolYearsForReports();
  const yearId = schoolYears.some(
    (year: Record<string, string>) => year.id === searchParams.yearId,
  )
    ? searchParams.yearId
    : undefined;

  const [progress, subjects, activeYear, roster, streaks] = await Promise.all([
    getChildProgress(params.id, yearId),
    getChildSubjects(params.id, yearId),
    getActiveSchoolYear(),
    getChildRoster(),
    getCompletionStreaks(),
  ]);

  const index = roster.findIndex((entry) => entry.id === params.id);
  const color = kidColorFor(index === -1 ? 0 : index);
  const streak =
    streaks.find((row) => row.child_id === params.id)?.current ?? 0;
  const completionPct =
    progress.total_lessons > 0
      ? Math.round((progress.completed / progress.total_lessons) * 100)
      : 0;
  const yearLabel = yearId
    ? schoolYears.find((year: Record<string, string>) => year.id === yearId)
        ?.label
    : activeYear?.label;

  return (
    <div>
      {child.banner_url && (
        <div className="relative mb-6 h-40 overflow-hidden rounded-card">
          <Image
            src={child.banner_url}
            alt=""
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-xl"
          style={{
            backgroundColor: color.bg,
            borderColor: color.solid,
            color: color.text,
          }}
        >
          {child.emoji || child.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-primary">{child.name}</h1>
          <p className="mt-0.5 text-sm italic text-tertiary">
            {yearLabel ? `${yearLabel} · ` : ""}
            {subjects.length} {subjects.length === 1 ? "subject" : "subjects"} ·{" "}
            {completionPct}% complete
          </p>
        </div>
        {schoolYears.length > 0 && (
          <div className="ml-auto">
            <SchoolYearSelector
              schoolYears={schoolYears}
              currentYearId={yearId || ""}
            />
          </div>
        )}
      </div>

      <StudentTabs childId={params.id} active={tab} yearId={yearId} />

      {tab === "overview" && (
        <OverviewPanel
          childId={params.id}
          subjects={subjects as Row[]}
          progress={progress}
          completionPct={completionPct}
          streak={streak}
          yearId={yearId}
          hasYear={Boolean(yearId || activeYear)}
        />
      )}
      {tab === "grades" && <GradesPanel childId={params.id} yearId={yearId} />}
      {tab === "reading" && <ReadingPanel childId={params.id} />}
      {tab === "attendance" && (
        <AttendancePanel childId={params.id} yearId={yearId} />
      )}
    </div>
  );
}

async function OverviewPanel({
  childId,
  subjects,
  progress,
  completionPct,
  streak,
  yearId,
  hasYear,
}: {
  childId: string;
  subjects: Row[];
  progress: Row;
  completionPct: number;
  streak: number;
  yearId?: string;
  hasYear: boolean;
}) {
  const [courses, readingStats, yearOverYear] = await Promise.all([
    getCompletedCurricula(childId, yearId),
    getReadingStats(childId),
    getYearOverYearProgress(childId),
  ]);

  const coursesBySubject = new Map<string, Row[]>();
  for (const course of courses as Row[]) {
    const key = String(course.subject_name || "Uncategorized");
    if (!coursesBySubject.has(key)) coursesBySubject.set(key, []);
    coursesBySubject.get(key)!.push(course);
  }

  return (
    <div className="flex flex-col gap-4">
      {subjects.length === 0 ? (
        <Card>
          <EmptyState
            message="No courses assigned yet"
            hint={
              hasYear
                ? "Assign a course to this student to start tracking progress."
                : "Set up a school year, then assign courses to this student."
            }
          >
            <Link
              href="/curricula"
              className="rounded-xl bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-[var(--brand-contrast)]"
            >
              Browse courses
            </Link>
          </EmptyState>
        </Card>
      ) : (
        subjects.map((subject) => {
          const total = Number(subject.total_lessons) || 0;
          const done = Number(subject.completed_lessons) || 0;
          const percent = total > 0 ? Math.round((done / total) * 100) : 0;
          const average = Number(subject.avg_grade) || 0;
          const subjectCourses =
            coursesBySubject.get(String(subject.name)) || [];
          return (
            <section
              key={String(subject.id)}
              className="rounded-card border border-light bg-surface p-4 shadow-warm"
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: String(subject.color) }}
                />
                <Link
                  href={`/subjects/${subject.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {String(subject.name)}
                </Link>
                <span className="ml-auto text-sm text-tertiary">
                  {subjectCourses.length}{" "}
                  {subjectCourses.length === 1 ? "course" : "courses"}
                  {average > 0 ? ` · ${average.toFixed(1)}` : ""}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className="h-full rounded-full bg-[var(--interactive)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {done} / {total} lessons
                {subjectCourses.length > 0 && " · "}
                {subjectCourses
                  .map(
                    (course) =>
                      `${course.curriculum_name} (${
                        Number(course.total_lessons) > 0
                          ? Math.round(
                              (Number(course.completed_lessons ?? 0) /
                                Number(course.total_lessons)) *
                                100,
                            )
                          : 0
                      }%)`,
                  )
                  .join(" · ")}
              </p>
            </section>
          );
        })
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={<BookOpen size={14} className="text-[var(--interactive)]" />}
          label="Reading"
          value={`${readingStats.books_read} books`}
        />
        <StatTile
          icon={<CalendarCheck size={14} className="text-[var(--interactive)]" />}
          label="Completed"
          value={`${progress.completed} lessons`}
        />
        <StatTile
          icon={<Flame size={14} className="text-[var(--accent-solid)]" />}
          label="Streak"
          value={`${streak} ${streak === 1 ? "day" : "days"}`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <QuickAction
          href={`/api/reports/export?childId=${childId}`}
          icon={<FileText size={14} />}
        >
          Report card
        </QuickAction>
        <QuickAction
          href={`/api/reports/transcript?childId=${childId}`}
          icon={<Award size={14} />}
        >
          Transcript
        </QuickAction>
        <QuickAction
          href={`/reports/attendance?childId=${childId}`}
          icon={<ClipboardList size={14} />}
        >
          Attendance report
        </QuickAction>
      </div>

      {yearOverYear.length > 1 && (
        <Card title="Year over year">
          <YearOverYearChart data={yearOverYear} childId={childId} />
        </Card>
      )}

      <p className="text-xs text-muted">
        {completionPct}% of assigned work complete.
      </p>
    </div>
  );
}

async function GradesPanel({
  childId,
  yearId,
}: {
  childId: string;
  yearId?: string;
}) {
  const [grades, summary, thresholds] = await Promise.all([
    getGradesByChild(childId, yearId),
    getGradeSummary(childId, yearId),
    getDefaultScaleThresholds(),
  ]);
  const thresholdsForClient = thresholds.map((threshold) => ({
    letter: threshold.letter,
    min_score: threshold.min_score,
    color: threshold.color,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Card title="By subject">
        {summary.length === 0 ? (
          <p className="text-sm text-muted">No graded work yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(summary as Row[]).map((row) => {
              const average = Number(row.avg_grade) || 0;
              const letter =
                average > 0
                  ? getLetterGrade(average, thresholdsForClient)
                  : null;
              return (
                <div
                  key={String(row.subject_name)}
                  className="flex items-center gap-2 border-b border-light pb-2 last:border-b-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: String(row.subject_color) }}
                  />
                  <span className="text-sm text-primary">
                    {String(row.subject_name)}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {letter && (
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                        style={{ backgroundColor: letter.color || "#6b7280" }}
                      >
                        {letter.letter}
                      </span>
                    )}
                    <span className="text-sm font-medium text-primary">
                      {average > 0 ? average.toFixed(1) : "--"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="All grades">
        {grades.length === 0 ? (
          <EmptyState
            message="No grades recorded yet"
            hint="Grades appear here once lessons are completed with a score."
          />
        ) : (
          <GradesTableClient
            grades={
              grades as Array<{
                completion_id: string;
                grade: number;
                notes: string | null;
                completed_at: string;
                lesson_title: string;
                lesson_id: string;
                subject_id: string;
                subject_name: string;
                child_name: string;
              }>
            }
            thresholds={thresholdsForClient}
          />
        )}
      </Card>
    </div>
  );
}

async function ReadingPanel({ childId }: { childId: string }) {
  const [entries, stats] = await Promise.all([
    getReadingLog(childId),
    getReadingStats(childId),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Books" value={String(stats.books_read)} />
        <StatTile label="Pages" value={String(stats.total_pages)} />
        <StatTile label="Minutes" value={String(stats.total_minutes)} />
      </div>
      <Card title="Reading log">
        {entries.length === 0 ? (
          <EmptyState
            message="Nothing logged yet"
            hint="Reading entries show up here as they are added."
          >
            <Link
              href="/reading"
              className="rounded-xl bg-[var(--interactive)] px-4 py-2 text-sm font-medium text-[var(--brand-contrast)]"
            >
              Open reading log
            </Link>
          </EmptyState>
        ) : (
          <ul className="flex flex-col">
            {(entries as Row[]).slice(0, 25).map((entry) => (
              <li
                key={String(entry.id)}
                className="flex flex-wrap items-baseline gap-x-2 border-b border-light py-2 text-sm last:border-b-0"
              >
                <span className="text-primary">
                  {String(entry.resource_title || "Untitled")}
                </span>
                <span className="text-xs text-muted">
                  {entry.pages_read ? `${entry.pages_read} pages` : ""}
                  {entry.pages_read && entry.minutes_read ? " · " : ""}
                  {entry.minutes_read ? `${entry.minutes_read} min` : ""}
                </span>
                <span className="ml-auto text-xs text-tertiary">
                  {String(entry.date || "").slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

async function AttendancePanel({
  childId,
  yearId,
}: {
  childId: string;
  yearId?: string;
}) {
  const years = await getAllSchoolYearsForReports();
  const year =
    (yearId &&
      years.find((entry: Record<string, string>) => entry.id === yearId)) ||
    years[0];

  const start = year?.start_date
    ? String(year.start_date).slice(0, 10)
    : `${todayKey().slice(0, 4)}-01-01`;
  const end = year?.end_date ? String(year.end_date).slice(0, 10) : todayKey();
  const summary = await getAttendanceSummary(childId, start, end);

  if (!summary) {
    return (
      <Card>
        <EmptyState message="No attendance to show for this range" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Days attended" value={String(summary.daysAttended)} />
        <StatTile label="Hours" value={String(summary.totalHours)} />
        <StatTile
          label="Minutes per day"
          value={String(summary.defaultMinutesPerDay)}
        />
      </div>
      <Card title={`Days${year?.label ? ` · ${year.label}` : ""}`}>
        {summary.days.length === 0 ? (
          <EmptyState message="No school days recorded in this range" />
        ) : (
          <ul className="flex flex-col">
            {summary.days.slice(0, 40).map((day) => (
              <li
                key={day.date}
                className="flex items-baseline gap-2 border-b border-light py-1.5 text-sm last:border-b-0"
              >
                <span className="text-primary">{day.date}</span>
                <span className="text-xs capitalize text-tertiary">
                  {day.status}
                </span>
                <span className="ml-auto text-xs text-muted">
                  {day.lessonsCompleted} lessons · {day.minutes} min
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <QuickAction
        href={`/reports/attendance?childId=${childId}`}
        icon={<ClipboardList size={14} />}
      >
        Full attendance report
      </QuickAction>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-card border border-light bg-surface p-3 shadow-warm">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl text-primary">{value}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-tertiary transition-colors hover:border-interactive-border hover:text-primary"
    >
      {icon}
      {children}
    </Link>
  );
}
