export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import GradesTableClient from "@/components/grades/GradesTableClient";
import { getAllGrades } from "@/lib/queries/grades";
import { getAllChildren } from "@/lib/queries/students";
import { getGradeSummary } from "@/lib/queries/grades";

export default async function GradesPage() {
  const [grades, children] = await Promise.all([
    getAllGrades(),
    getAllChildren(),
  ]);

  // Get grade summaries per child
  const summaries = await Promise.all(
    children.map(async (c: Record<string, string>) => ({
      childName: c.name,
      childId: c.id,
      subjects: await getGradeSummary(c.id),
    })),
  );

  return (
    <div>
      <PageHeader title="Grades" />

      {/* Grade Summaries by Student */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {summaries.map((summary) => (
          <Card key={summary.childId} title={summary.childName}>
            <div className="space-y-3">
              {summary.subjects.map((s: Record<string, string | number>) => (
                <div
                  key={`${summary.childId}-${s.subject_name}`}
                  className="flex items-center justify-between"
                >
                  <Link
                    href={`/subjects/${s.subject_id}`}
                    className="flex items-center gap-2 hover:opacity-80"
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: String(s.subject_color) }}
                    />
                    <span className="text-sm text-interactive hover:underline">
                      {String(s.subject_name)}
                    </span>
                  </Link>
                  <div className="text-right">
                    <span className="font-semibold">
                      {Number(s.avg_grade) > 0
                        ? Number(s.avg_grade).toFixed(1)
                        : "--"}
                    </span>
                    {Number(s.graded_count) > 0 && (
                      <span className="ml-1 text-xs text-muted">
                        ({s.graded_count})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* All Grades Table */}
      <Card title="All Grades">
        {grades.length === 0 ? (
          <EmptyState message="No grades recorded yet" icon="📝" />
        ) : (
          <GradesTableClient
            grades={grades as Array<{
              completion_id: string;
              grade: number;
              notes: string | null;
              completed_at: string;
              lesson_title: string;
              lesson_id: string;
              subject_id: string;
              subject_name: string;
              child_name: string;
            }>}
          />
        )}
      </Card>
    </div>
  );
}
