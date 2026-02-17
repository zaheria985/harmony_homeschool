export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { CurriculumViewToggle } from "@/components/curricula/CurriculumViewToggle";
import ScheduleSection from "@/components/curricula/ScheduleSection";
import CompletionCopyBanner from "@/components/curricula/CompletionCopyBanner";
import {
  getAssignmentDaysForCurriculum,
  getCompletionMismatches,
  getCurriculumDetail,
} from "@/lib/queries/curricula";
export default async function CurriculumDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [curriculum, assignmentDays, mismatches] = await Promise.all([
    getCurriculumDetail(params.id),
    getAssignmentDaysForCurriculum(params.id),
    getCompletionMismatches(params.id),
  ]);
  if (!curriculum) notFound();
  const totalLessons = curriculum.lessons.length;
  const completedLessons = curriculum.lessons.filter(
    (l: { status: string }) => l.status === "completed",
  ).length;
  const completionPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const unscheduledCount = curriculum.lessons.filter(
    (l: { planned_date: string | null; status: string }) =>
      !l.planned_date && l.status !== "completed",
  ).length;
  return (
    <div>
      {" "}
      {curriculum.cover_image && (
        <div className="mb-6 max-w-sm overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={curriculum.cover_image}
            alt={curriculum.name}
            className="w-full rounded-xl object-cover"
          />
        </div>
      )}{" "}
      <PageHeader title={curriculum.name}>
        {" "}
        <div className="flex items-center gap-2">
          {" "}
          <CurriculumViewToggle curriculumId={params.id} />{" "}
          <Link
            href={`/subjects/${curriculum.subject_id}`}
            className="rounded-lg border px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
          >
            {" "}
            Back to {curriculum.subject_name}{" "}
          </Link>{" "}
        </div>{" "}
      </PageHeader>{" "}
      <CompletionCopyBanner
        curriculumId={params.id}
        mismatches={mismatches}
      />
      <div className="mb-6 flex items-center gap-3">
        {" "}
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: curriculum.subject_color }}
        />{" "}
        <span className="text-sm text-muted">
          {" "}
          <Link
            href={`/subjects/${curriculum.subject_id}`}
            className="text-interactive hover:underline"
          >
            {" "}
            {curriculum.subject_name}{" "}
          </Link>{" "}
          {" ·"}{" "}
          <Link
            href={`/students/${curriculum.child_id}`}
            className="text-interactive hover:underline"
          >
            {" "}
            {curriculum.child_name}{" "}
          </Link>{" "}
        </span>{" "}
      </div>{" "}
      {curriculum.description && (
        <p className="mb-6 text-tertiary">{curriculum.description}</p>
      )}{" "}
      {/* Overview */}{" "}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {" "}
        <Card>
          {" "}
          <p className="text-sm text-muted">Total Lessons</p>{" "}
          <p className="font-display text-2xl">{totalLessons}</p>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <p className="text-sm text-muted">Completed</p>{" "}
          <p className="font-display text-2xl text-success-600">
            {completedLessons}
          </p>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <p className="text-sm text-muted">Progress</p>{" "}
          <p className="font-display text-2xl">{completionPct}%</p>{" "}
          <ProgressBar
            value={completionPct}
            showLabel={false}
            color="success"
          />{" "}
        </Card>{" "}
      </div>{" "}
      <Card title="Schedule" className="mb-8">
        {" "}
        <ScheduleSection
          curriculumId={params.id}
          assignments={assignmentDays.map((row) => ({
            assignmentId: row.assignment_id,
            childId: row.child_id,
            childName: row.child_name,
            configuredWeekdays: row.configured_weekdays,
            schoolWeekdays: row.school_weekdays,
          }))}
          unscheduledCount={unscheduledCount}
        />{" "}
      </Card>{" "}
      {/* Lessons */}{" "}
      <Card title="Lessons">
        {" "}
        {curriculum.lessons.length === 0 ? (
          <p className="py-4 text-center text-muted">No lessons yet</p>
        ) : (
          <div className="space-y-3">
            {" "}
            {curriculum.lessons.map(
              (l: Record<string, string | number | null>) => (
                <Link
                  key={String(l.id)}
                  href={`/lessons/${l.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-surface-muted"
                >
                  {" "}
                  <div>
                    {" "}
                    <p className="font-medium">{String(l.title)}</p>{" "}
                    {l.description && (
                      <p className="mt-0.5 text-sm text-muted">
                        {" "}
                        {String(l.description)}{" "}
                      </p>
                    )}{" "}
                    {l.planned_date && (
                      <p className="mt-0.5 text-xs text-muted">
                        {" "}
                        {new Date(
                          String(l.planned_date),
                        ).toLocaleDateString()}{" "}
                      </p>
                    )}{" "}
                  </div>{" "}
                  <div className="flex items-center gap-3">
                    {" "}
                    {l.grade != null && (
                      <span className="font-semibold text-interactive">
                        {" "}
                        {Number(l.grade).toFixed(0)}{" "}
                      </span>
                    )}{" "}
                    <Badge
                      variant={
                        l.status === "completed"
                          ? "success"
                          : l.status === "in_progress"
                            ? "warning"
                            : "default"
                      }
                    >
                      {" "}
                      {String(l.status)}{" "}
                    </Badge>{" "}
                  </div>{" "}
                </Link>
              ),
            )}{" "}
          </div>
        )}{" "}
      </Card>{" "}
    </div>
  );
}
