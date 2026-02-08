export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getDashboardStats, getUpcomingDueLessons } from "@/lib/queries/dashboard";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const upcoming = await getUpcomingDueLessons(3);

  const yearCompletionRate =
    stats.active_year_total_lessons > 0
      ? Math.round(
          (stats.active_year_completed_lessons / stats.active_year_total_lessons) * 100
        )
      : 0;

  return (
    <div>
      <PageHeader title="Dashboard" />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <StatCard label="Total Students" value={stats.total_students} color="primary" />
        <StatCard
          label="Year Completion Rate"
          value={`${yearCompletionRate}%`}
          sublabel={`${stats.active_year_completed_lessons} of ${stats.active_year_total_lessons}`}
          color="success"
        />
      </div>

      <Card title="Due in the Next 3 Days">
        {upcoming.length === 0 ? (
          <p className="py-8 text-center text-gray-400">Nothing due in the next 3 days</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Due</th>
                  <th className="pb-3 font-medium">Student</th>
                  <th className="pb-3 font-medium">Lesson</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Course</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {upcoming.map((item: Record<string, string | number | null>) => (
                  <tr key={String(item.id)} className="hover:bg-gray-50">
                    <td className="py-3">
                      {item.planned_date
                        ? new Date(String(item.planned_date) + "T00:00:00").toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="py-3 font-medium">{String(item.child_name)}</td>
                    <td className="py-3">
                      <Link href={`/lessons/${item.id}`} className="text-primary-600 hover:underline">
                        {String(item.title)}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Link href={`/subjects/${item.subject_id}`}>
                        <Badge variant="primary">{String(item.subject_name)}</Badge>
                      </Link>
                    </td>
                    <td className="py-3 text-gray-500">
                      {String(item.curriculum_name)}
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
