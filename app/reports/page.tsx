export const dynamic = "force-dynamic";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import { getAllChildren } from "@/lib/queries/students";
import { getProgressReport } from "@/lib/queries/reports";
import { getAllGrades } from "@/lib/queries/grades";
import { getCurrentUser } from "@/lib/session";
type ReportData = Awaited<ReturnType<typeof getProgressReport>>;
function performanceFeedback(percent: number): string {
  if (percent >= 85)
    return "Excellent consistency - strong momentum this year.";
  if (percent >= 65) return "Solid progress - you are mostly on track.";
  if (percent >= 40)
    return "Making progress - a little focus this week will help.";
  return "Early-stage progress - consider a lighter catch-up plan for the next few days.";
}
function subjectColor(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  return "#4f46e5";
}
export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { student?: string };
}) {
  const user = await getCurrentUser();
  const [children, grades] = await Promise.all([
    getAllChildren(user.role === "parent" ? user.id : undefined),
    getAllGrades(),
  ]);
  const reports = await Promise.all(
    children.map(async (c: Record<string, string>) => ({
      childId: c.id,
      childName: c.name,
      report: await getProgressReport(c.id),
    })),
  );
  const totalLessons = reports.reduce(
    (acc, r) => acc + Number(r.report.overall.total_lessons || 0),
    0,
  );
  const completedLessons = reports.reduce(
    (acc, r) => acc + Number(r.report.overall.completed || 0),
    0,
  );
  const inProgressLessons = reports.reduce(
    (acc, r) => acc + Number(r.report.overall.in_progress || 0),
    0,
  );
  const overallPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const selectedId = searchParams?.student || "";
  const selected = reports.find((r) => r.childId === selectedId) || null;
  const selectedGrades = selectedId
    ? grades.filter(
        (grade: Record<string, string | number | null>) =>
          String(grade.child_id) === selectedId,
      )
    : grades;
  const avgGrade = selectedGrades.length
    ? selectedGrades.reduce(
        (sum: number, grade: Record<string, string | number | null>) => {
          const value = Number(grade.grade);
          return Number.isFinite(value) ? sum + value : sum;
        },
        0,
      ) / selectedGrades.length
    : 0;
  const gradeBandCounts = selectedGrades.reduce(
    (
      acc: {
        excellent: number;
        strong: number;
        developing: number;
        support: number;
      },
      grade: Record<string, string | number | null>,
    ) => {
      const value = Number(grade.grade);
      if (!Number.isFinite(value)) return acc;
      if (value >= 90) acc.excellent += 1;
      else if (value >= 80) acc.strong += 1;
      else if (value >= 70) acc.developing += 1;
      else acc.support += 1;
      return acc;
    },
    { excellent: 0, strong: 0, developing: 0, support: 0 },
  );
  return (
    <div>
      {" "}
      <PageHeader title="Progress Reports" />{" "}
      <Card title="Students">
        {" "}
        {reports.length === 0 ? (
          <p className="text-sm text-muted">
            No students yet.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {" "}
            {reports.map((r) => {
              const pct =
                Number(r.report.overall.total_lessons) > 0
                  ? Math.round(
                      (Number(r.report.overall.completed) /
                        Number(r.report.overall.total_lessons)) *
                        100,
                    )
                  : 0;
              const active = selectedId === r.childId;
              return (
                <Link
                  key={r.childId}
                  href={`/reports?student=${r.childId}`}
                  className={`rounded-lg border px-3 py-2 transition-colors ${active ? "border-interactive-border bg-interactive-light/30" : "border-light hover:bg-surface-muted"}`}
                >
                  {" "}
                  <p className="font-medium text-primary">{r.childName}</p>{" "}
                  <p className="text-xs text-muted">
                    {pct}% complete
                  </p>{" "}
                </Link>
              );
            })}{" "}
          </div>
        )}{" "}
      </Card>{" "}
      <Card title="Overall Household Progress" className="mt-6">
        {" "}
        <div className="grid gap-4 sm:grid-cols-3">
          {" "}
          <div>
            {" "}
            <p className="text-sm text-muted">
              Completion
            </p>{" "}
            <p className="font-display text-2xl text-primary">{overallPct}%</p>{" "}
            <ProgressBar
              value={overallPct}
              showLabel={false}
              color="success"
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <p className="text-sm text-muted">
              Completed Lessons
            </p>{" "}
            <p className="font-display text-2xl text-success-600">
              {completedLessons}
            </p>{" "}
          </div>{" "}
          <div>
            {" "}
            <p className="text-sm text-muted">
              In Progress
            </p>{" "}
            <p className="font-display text-2xl text-warning-600">
              {inProgressLessons}
            </p>{" "}
          </div>{" "}
        </div>{" "}
        <p className="mt-3 text-sm text-tertiary">
          {performanceFeedback(overallPct)}
        </p>{" "}
      </Card>{" "}
      <Card title="Student Detail" className="mt-6">
        {" "}
        {!selected ? (
          <p className="text-sm text-muted">
            Select a student above to view their personal progress report.
          </p>
        ) : (
          <StudentReport
            childName={selected.childName}
            report={selected.report}
          />
        )}{" "}
      </Card>{" "}
      <Card title="Grade Insights" className="mt-6">
        {" "}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {" "}
          <div>
            {" "}
            <p className="text-sm text-muted">Scope</p>{" "}
            <p className="text-lg font-semibold text-primary">
              {selected ? selected.childName : "Household"}
            </p>{" "}
          </div>{" "}
          <div>
            {" "}
            <p className="text-sm text-muted">
              Average Grade
            </p>{" "}
            <p className="text-lg font-semibold text-primary">
              {selectedGrades.length ? avgGrade.toFixed(1) : "--"}
            </p>{" "}
          </div>{" "}
          <div>
            {" "}
            <p className="text-sm text-muted">
              Recorded Grades
            </p>{" "}
            <p className="text-lg font-semibold text-primary">
              {selectedGrades.length}
            </p>{" "}
          </div>{" "}
          <div>
            {" "}
            <p className="text-sm text-muted">View</p>{" "}
            <Link
              href="/grades"
              className="text-sm font-medium text-interactive hover:underline"
            >
              {" "}
              Open full gradebook{" "}
            </Link>{" "}
          </div>{" "}
        </div>{" "}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {" "}
          <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success-text)]">
            {" "}
            Excellent (90+): <strong>{gradeBandCounts.excellent}</strong>{" "}
          </p>{" "}
          <p className="rounded-lg border border-[var(--info-border)] bg-[var(--info-bg)] px-3 py-2 text-sm text-[var(--info-text)]">
            {" "}
            Strong (80-89): <strong>{gradeBandCounts.strong}</strong>{" "}
          </p>{" "}
          <p className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-text)]">
            {" "}
            Developing (70-79):{" "}
            <strong>{gradeBandCounts.developing}</strong>{" "}
          </p>{" "}
          <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
            {" "}
            Needs support (&lt;70):{" "}
            <strong>{gradeBandCounts.support}</strong>{" "}
          </p>{" "}
        </div>{" "}
      </Card>{" "}
    </div>
  );
}
function StudentReport({
  childName,
  report,
}: {
  childName: string;
  report: ReportData;
}) {
  const completionPct =
    Number(report.overall.total_lessons) > 0
      ? Math.round(
          (Number(report.overall.completed) /
            Number(report.overall.total_lessons)) *
            100,
        )
      : 0;
  const numericSubjects = report.subjects.filter(
    (s: Record<string, string | number>) =>
      String(s.grade_type || "numeric") === "numeric",
  );
  const passFailSubjects = report.subjects.filter(
    (s: Record<string, string | number>) =>
      String(s.grade_type || "numeric") === "pass_fail",
  );
  return (
    <div>
      {" "}
      <h2 className="mb-4 text-lg font-bold text-primary">{childName}</h2>{" "}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {" "}
        <div>
          {" "}
          <p className="text-sm text-muted">
            Completion
          </p>{" "}
          <p className="font-display text-xl text-primary">
            {completionPct}%
          </p>{" "}
        </div>{" "}
        <div>
          {" "}
          <p className="text-sm text-muted">
            Completed
          </p>{" "}
          <p className="font-display text-xl text-success-600">
            {String(report.overall.completed)}
          </p>{" "}
        </div>{" "}
        <div>
          {" "}
          <p className="text-sm text-muted">
            In Progress
          </p>{" "}
          <p className="font-display text-xl text-warning-600">
            {String(report.overall.in_progress)}
          </p>{" "}
        </div>{" "}
      </div>{" "}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {" "}
        <div className="rounded-lg border border-light bg-surface p-4">
          {" "}
          <h3 className="mb-3 text-sm font-semibold text-secondary">
            Subject Breakdown
          </h3>{" "}
          <div className="space-y-3">
            {" "}
            {report.subjects.map((s: Record<string, string | number>) => {
              const pct =
                Number(s.total_lessons) > 0
                  ? Math.round(
                      (Number(s.completed) / Number(s.total_lessons)) * 100,
                    )
                  : 0;
              const color = subjectColor(s.subject_color);
              return (
                <div key={String(s.subject_id)}>
                  {" "}
                  <div className="mb-1 flex items-center justify-between text-xs">
                    {" "}
                    <span className="font-medium text-secondary">
                      {String(s.subject_name)}
                    </span>{" "}
                    <span className="text-muted">{pct}%</span>{" "}
                  </div>{" "}
                  <div className="h-2 w-full rounded-full bg-surface-subtle">
                    {" "}
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${Math.max(pct, 2)}%`,
                        backgroundColor: color,
                      }}
                    />{" "}
                  </div>{" "}
                </div>
              );
            })}{" "}
          </div>{" "}
        </div>{" "}
        <div className="rounded-lg border border-light bg-surface p-4">
          {" "}
          <h3 className="mb-3 text-sm font-semibold text-secondary">
            Grade Averages by Subject
          </h3>{" "}
          <div className="flex min-h-[180px] items-end gap-3">
            {" "}
            {report.subjects.map((s: Record<string, string | number>) => {
              const grade = Number(s.avg_grade);
              const hasGrade = Number.isFinite(grade) && grade > 0;
              const barHeight = hasGrade
                ? Math.max(18, Math.round(grade * 1.5))
                : 14;
              const color = subjectColor(s.subject_color);
              return (
                <div
                  key={`chart-${String(s.subject_id)}`}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1"
                >
                  {" "}
                  <span className="text-[10px] font-semibold text-tertiary">
                    {" "}
                    {hasGrade ? grade.toFixed(0) : "--"}{" "}
                  </span>{" "}
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: `${barHeight}px`,
                      backgroundColor: color,
                      opacity: hasGrade ? 1 : 0.25,
                    }}
                  />{" "}
                  <span className="line-clamp-1 text-center text-[10px] text-muted">
                    {" "}
                    {String(s.subject_name).split("")[0]}{" "}
                  </span>{" "}
                </div>
              );
            })}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      {numericSubjects.length > 0 && (
        <div className="mb-5">
          {" "}
          <h3 className="mb-2 text-sm font-semibold text-secondary">
            Numeric Grade Courses
          </h3>{" "}
          <div className="space-y-3">
            {" "}
            {numericSubjects.map((s: Record<string, string | number>) => {
              const pct =
                Number(s.total_lessons) > 0
                  ? Math.round(
                      (Number(s.completed) / Number(s.total_lessons)) * 100,
                    )
                  : 0;
              return (
                <div key={String(s.subject_id)}>
                  {" "}
                  <div className="mb-1 flex items-center justify-between text-sm">
                    {" "}
                    <span className="font-medium text-primary">
                      {String(s.subject_name)}
                    </span>{" "}
                    <span className="text-muted">
                      {" "}
                      {String(s.completed)}/{String(s.total_lessons)}{" "}
                      lessons{" "}
                    </span>{" "}
                  </div>{" "}
                  <p className="mb-1 text-xs text-muted">
                    Average: {Number(s.avg_grade).toFixed(1)}
                  </p>{" "}
                  <ProgressBar
                    value={pct}
                    showLabel={false}
                    color="success"
                  />{" "}
                </div>
              );
            })}{" "}
          </div>{" "}
        </div>
      )}{" "}
      {passFailSubjects.length > 0 && (
        <div>
          {" "}
          <h3 className="mb-2 text-sm font-semibold text-secondary">
            Pass / Fail Courses
          </h3>{" "}
          <div className="space-y-3">
            {" "}
            {passFailSubjects.map((s: Record<string, string | number>) => {
              const pct =
                Number(s.total_lessons) > 0
                  ? Math.round(
                      (Number(s.completed) / Number(s.total_lessons)) * 100,
                    )
                  : 0;
              return (
                <div key={String(s.subject_id)}>
                  {" "}
                  <div className="mb-1 flex items-center justify-between text-sm">
                    {" "}
                    <span className="font-medium text-primary">
                      {String(s.subject_name)}
                    </span>{" "}
                    <span className="text-muted">
                      {" "}
                      Pass {String(s.pass_count)} / Fail{" "}
                      {String(s.fail_count)}{" "}
                    </span>{" "}
                  </div>{" "}
                  <ProgressBar
                    value={pct}
                    showLabel={false}
                    color="success"
                  />{" "}
                </div>
              );
            })}{" "}
          </div>{" "}
        </div>
      )}{" "}
      {numericSubjects.length === 0 && passFailSubjects.length === 0 && (
        <p className="text-sm text-muted">
          No course progress yet.
        </p>
      )}{" "}
    </div>
  );
}
