export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
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
    }))
  );

  return (
    <div>
      <PageHeader title="Grades" />

      {/* Grade Summaries by Student */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {summaries.map((summary) => (
          <Card key={summary.childId} title={summary.childName}>
            <div className="space-y-3">
              {summary.subjects.map(
                (s: Record<string, string | number>) => (
                  <div
                    key={`${summary.childId}-${s.subject_name}`}
                    className="flex items-center justify-between"
                  >
                    <Link href={`/subjects/${s.subject_id}`} className="flex items-center gap-2 hover:opacity-80">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: String(s.subject_color) }}
                      />
                      <span className="text-sm text-primary-600 hover:underline">{String(s.subject_name)}</span>
                    </Link>
                    <div className="text-right">
                      <span className="font-semibold">
                        {Number(s.avg_grade) > 0 ? Number(s.avg_grade).toFixed(1) : "--"}
                      </span>
                      {Number(s.graded_count) > 0 && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({s.graded_count})
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* All Grades Table */}
      <Card title="All Grades">
        {grades.length === 0 ? (
          <EmptyState message="No grades recorded yet" icon="📝" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Student</th>
                  <th className="pb-3 font-medium">Lesson</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Grade</th>
                  <th className="pb-3 font-medium">Notes</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {grades.map((g: Record<string, string | number | null>) => (
                  <tr key={String(g.completion_id)} className="hover:bg-gray-50">
                    <td className="py-3 font-medium">{String(g.child_name)}</td>
                    <td className="py-3">
                      <Link href={`/lessons/${g.lesson_id}`} className="text-primary-600 hover:underline">
                        {String(g.lesson_title)}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Link href={`/subjects/${g.subject_id}`}>
                        <Badge variant="primary">{String(g.subject_name)}</Badge>
                      </Link>
                    </td>
                    <td className="py-3">
                      <span
                        className={`font-semibold ${
                          Number(g.grade) >= 90
                            ? "text-success-600"
                            : Number(g.grade) >= 80
                              ? "text-primary-600"
                              : Number(g.grade) >= 70
                                ? "text-warning-600"
                                : "text-red-600"
                        }`}
                      >
                        {Number(g.grade).toFixed(0)}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">
                      {g.notes ? String(g.notes) : "--"}
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(String(g.completed_at)).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
