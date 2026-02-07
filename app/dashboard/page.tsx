export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getDashboardStats, getRecentActivity } from "@/lib/queries/dashboard";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const activity = await getRecentActivity(10);

  const completionRate =
    stats.total_lessons > 0
      ? Math.round((stats.completed_lessons / stats.total_lessons) * 100)
      : 0;

  return (
    <div>
      <PageHeader title="Dashboard" />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={stats.total_students} color="primary" />
        <StatCard label="Total Lessons" value={stats.total_lessons} color="primary" />
        <StatCard
          label="Completion Rate"
          value={`${completionRate}%`}
          sublabel={`${stats.completed_lessons} of ${stats.total_lessons}`}
          color="success"
        />
        <StatCard
          label="Average Grade"
          value={Number(stats.avg_grade).toFixed(1)}
          color="warning"
        />
      </div>

      <Card title="Recent Activity">
        {activity.length === 0 ? (
          <p className="py-8 text-center text-gray-400">No recent activity</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Student</th>
                  <th className="pb-3 font-medium">Lesson</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Grade</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activity.map((a: Record<string, string | number | null>) => (
                  <tr key={String(a.id)} className="hover:bg-gray-50">
                    <td className="py-3 font-medium">{String(a.child_name)}</td>
                    <td className="py-3">
                      <Link href={`/lessons/${a.lesson_id}`} className="text-primary-600 hover:underline">
                        {String(a.lesson_title)}
                      </Link>
                    </td>
                    <td className="py-3">
                      <Link href={`/subjects/${a.subject_id}`}>
                        <Badge variant="primary">{String(a.subject_name)}</Badge>
                      </Link>
                    </td>
                    <td className="py-3">
                      {a.grade != null ? (
                        <span className="font-semibold">{Number(a.grade).toFixed(0)}</span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(String(a.completed_at)).toLocaleDateString()}
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
