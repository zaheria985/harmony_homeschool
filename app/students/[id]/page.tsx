export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import {
  getActiveSchoolYear,
  getChildById,
  getChildProgress,
  getChildSubjects,
  getCompletedCurricula,
} from "@/lib/queries/students";
import { getUpcomingLessons } from "@/lib/queries/lessons";
export default async function StudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const child = await getChildById(params.id);
  if (!child) notFound();
  const [progress, subjects, upcoming, completedCurricula, activeYear] =
    await Promise.all([
      getChildProgress(params.id),
      getChildSubjects(params.id),
      getUpcomingLessons(params.id, 5),
      getCompletedCurricula(params.id),
      getActiveSchoolYear(),
    ]);
  const completionPct =
    progress.total_lessons > 0
      ? Math.round((progress.completed / progress.total_lessons) * 100)
      : 0;
  return (
    <div>
      {" "}
      {/* Banner image */}{" "}
      {child.banner_url && (
        <div className="mb-6 h-48 overflow-hidden rounded-xl">
          {" "}
          <Image
            src={child.banner_url}
            alt={`${child.name} banner`}
            fill
            className="object-cover"
            priority
          />{" "}
        </div>
      )}{" "}
      <PageHeader
        title={`${child.emoji ? child.emoji + "" : ""}${child.name}`}
      />{" "}
      {/* Overview stats */}{" "}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {" "}
        <Card>
          {" "}
          <p className="text-sm text-muted">Total Lessons</p>{" "}
          <p className="font-display text-2xl">{progress.total_lessons}</p>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <p className="text-sm text-muted">Completed</p>{" "}
          <p className="font-display text-2xl text-success-600">
            {progress.completed}
          </p>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <p className="text-sm text-muted">In Progress</p>{" "}
          <p className="font-display text-2xl text-warning-600">
            {progress.in_progress}
          </p>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <p className="text-sm text-muted">Average Grade</p>{" "}
          <p className="font-display text-2xl">
            {Number(progress.avg_grade).toFixed(1)}
          </p>{" "}
        </Card>{" "}
      </div>{" "}
      <div className="grid gap-6 lg:grid-cols-2">
        {" "}
        {/* Subjects */}{" "}
        <Card title="Subjects">
          {" "}
          <div className="space-y-4">
            {" "}
            {subjects.map((s: Record<string, string | number>) => (
              <div key={String(s.id)} className="rounded-lg border p-4">
                {" "}
                <div className="mb-2 flex items-center justify-between">
                  {" "}
                  <Link
                    href={`/subjects/${s.id}`}
                    className="flex items-center gap-2 hover:opacity-80"
                  >
                    {" "}
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: String(s.color) }}
                    />{" "}
                    <span className="font-medium text-interactive hover:underline">
                      {String(s.name)}
                    </span>{" "}
                  </Link>{" "}
                  <span className="text-sm text-muted">
                    {" "}
                    Avg: {Number(s.avg_grade).toFixed(1)}{" "}
                  </span>{" "}
                </div>{" "}
                <ProgressBar
                  value={Number(s.completed_lessons)}
                  max={Number(s.total_lessons)}
                  color="primary"
                />{" "}
                <p className="mt-1 text-xs text-muted">
                  {" "}
                  {s.completed_lessons} / {s.total_lessons} lessons{" "}
                </p>{" "}
              </div>
            ))}{" "}
          </div>{" "}
        </Card>{" "}
        {/* Upcoming */}{" "}
        <Card title="Upcoming Lessons">
          {" "}
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-muted">
              No upcoming lessons
            </p>
          ) : (
            <div className="space-y-3">
              {" "}
              {upcoming.map((l: Record<string, string | number | null>) => (
                <div
                  key={String(l.id)}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  {" "}
                  <div>
                    {" "}
                    <Link
                      href={`/lessons/${l.id}`}
                      className="font-medium text-interactive hover:underline"
                    >
                      {" "}
                      {String(l.title)}{" "}
                    </Link>{" "}
                    <div className="mt-1 flex items-center gap-2">
                      {" "}
                      <Badge
                        variant={
                          l.status === "in_progress" ? "warning" : "default"
                        }
                      >
                        {" "}
                        {String(l.status)}{" "}
                      </Badge>{" "}
                      <Link href={`/subjects/${l.subject_id}`}>
                        {" "}
                        <Badge variant="primary">
                          {String(l.subject_name)}
                        </Badge>{" "}
                      </Link>{" "}
                    </div>{" "}
                  </div>{" "}
                  {l.planned_date && (
                    <span className="text-sm text-muted">
                      {" "}
                      {new Date(
                        String(l.planned_date),
                      ).toLocaleDateString()}{" "}
                    </span>
                  )}{" "}
                </div>
              ))}{" "}
            </div>
          )}{" "}
        </Card>{" "}
      </div>{" "}
      {/* Current Courses */}{" "}
      {activeYear && completedCurricula.length > 0 && (
        <div className="mt-6">
          {" "}
          <Card title={`Current Courses for ${activeYear.label}`}>
            {" "}
            <div className="space-y-3">
              {" "}
              {completedCurricula.map(
                (c: Record<string, string | number | boolean | null>) => (
                  <div
                    key={String(c.curriculum_id)}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    {" "}
                    <div className="flex items-center gap-3">
                      {" "}
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: String(c.subject_color) }}
                      />{" "}
                      <div>
                        {" "}
                        <Link
                          href={`/curricula/${c.curriculum_id}`}
                          className="font-medium text-interactive hover:underline"
                        >
                          {" "}
                          {String(c.curriculum_name)}{" "}
                        </Link>{" "}
                        <div className="flex items-center gap-2 text-xs text-muted">
                          {" "}
                          <span>{String(c.subject_name)}</span>{" "}
                          {c.school_year_name && (
                            <>
                              {" "}
                              <span>·</span>{" "}
                              <span>{String(c.school_year_name)}</span>{" "}
                            </>
                          )}{" "}
                          <span>·</span>{" "}
                          <span>{c.total_lessons} lessons</span>{" "}
                        </div>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      {Number(c.avg_grade) > 0 && (
                        <span className="text-sm font-semibold">
                          {" "}
                          {Number(c.avg_grade).toFixed(0)}%{" "}
                        </span>
                      )}{" "}
                      <Badge variant={c.is_complete ? "success" : "warning"}>
                        {" "}
                        {c.is_complete ? "Complete" : "In Progress"}{" "}
                      </Badge>{" "}
                    </div>{" "}
                  </div>
                ),
              )}{" "}
            </div>{" "}
          </Card>{" "}
        </div>
      )}{" "}
      {!activeYear && (
        <div className="mt-6">
          {" "}
          <Card title="Current Courses">
            {" "}
            <p className="text-sm text-muted">
              No active school year is configured right now.
            </p>{" "}
          </Card>{" "}
        </div>
      )}{" "}
      {/* Overall progress bar */}{" "}
      <div className="mt-6">
        {" "}
        <Card title="Overall Progress">
          {" "}
          <div className="space-y-2">
            {" "}
            <ProgressBar value={completionPct} color="success" />{" "}
            <p className="text-sm text-muted">
              {" "}
              {completionPct}% complete ({progress.completed} of{" "}
              {progress.total_lessons} lessons){" "}
            </p>{" "}
          </div>{" "}
        </Card>{" "}
      </div>{" "}
    </div>
  );
}
