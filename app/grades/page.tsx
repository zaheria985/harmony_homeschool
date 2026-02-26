export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { FileText, Settings } from "lucide-react";
import GradesTableClient from "@/components/grades/GradesTableClient";
import GradeTrendsChart from "@/components/grades/GradeTrendsChart";
import { getAllGrades, getGradeTrends } from "@/lib/queries/grades";
import { getAllChildren } from "@/lib/queries/students";
import { getGradeSummary } from "@/lib/queries/grades";
import { getDefaultScaleThresholds } from "@/lib/actions/grades";
import { getLetterGrade } from "@/lib/utils/grading";

export default async function GradesPage() {
  const [grades, children, trends, thresholds] = await Promise.all([
    getAllGrades(),
    getAllChildren(),
    getGradeTrends(),
    getDefaultScaleThresholds(),
  ]);

  // Serialize thresholds for client component
  const thresholdsForClient = thresholds.map((t) => ({
    letter: t.letter,
    min_score: t.min_score,
    color: t.color,
  }));

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
      <PageHeader title="Grades">
        <Link
          href="/settings"
          className="flex items-center gap-1.5 rounded-lg border border-light px-3 py-1.5 text-sm text-muted hover:text-primary hover:border-interactive transition-colors"
        >
          <Settings size={14} />
          Grading Scales
        </Link>
      </PageHeader>

      {/* Grade Summaries by Student */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        {summaries.map((summary) => (
          <Card key={summary.childId} title={summary.childName}>
            <div className="space-y-3">
              {summary.subjects.map((s: Record<string, string | number>) => {
                const avg = Number(s.avg_grade);
                const letterInfo = avg > 0 ? getLetterGrade(avg, thresholdsForClient) : null;
                return (
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
                    <div className="flex items-center gap-2 text-right">
                      {letterInfo && (
                        <span
                          className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                          style={{ backgroundColor: letterInfo.color || "#6b7280" }}
                        >
                          {letterInfo.letter}
                        </span>
                      )}
                      <span className="font-semibold">
                        {avg > 0 ? avg.toFixed(1) : "--"}
                      </span>
                      {Number(s.graded_count) > 0 && (
                        <span className="text-xs text-muted">
                          ({s.graded_count})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Grade Trends */}
      <div className="mb-8">
        <Card title="Grade Trends">
          <GradeTrendsChart
            trends={trends}
            children={children.map((c: Record<string, string>) => ({
              id: c.id,
              name: c.name,
            }))}
          />
        </Card>
      </div>

      {/* All Grades Table */}
      <Card title="All Grades">
        {grades.length === 0 ? (
          <EmptyState message="No grades recorded yet" icon={<FileText size={28} />} />
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
            thresholds={thresholdsForClient}
          />
        )}
      </Card>
    </div>
  );
}
