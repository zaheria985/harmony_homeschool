export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { getAdminStats } from "@/lib/queries/admin";

const sections = [
  {
    href: "/admin/children",
    label: "Children",
    icon: "👨‍🎓",
    description: "Add and manage student profiles",
    statKey: "child_count" as const,
  },
  {
    href: "/admin/subjects",
    label: "Subjects",
    icon: "📖",
    description: "Create subjects for each child and school year",
    statKey: "subject_count" as const,
  },
  {
    href: "/admin/curricula",
    label: "Courses",
    icon: "📋",
    description: "Manage courses and unit studies within subjects",
    statKey: "curriculum_count" as const,
  },
];

export default async function AdminPage() {
  const stats = await getAdminStats();

  return (
    <div>
      <PageHeader title="Admin" />

      <div className="mb-8 rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-primary-800">
        <strong>Data hierarchy:</strong> Children → Subjects → Courses → Lessons → Resources.
        Create items top-down — a child must exist before adding subjects, subjects before courses, etc.
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold">{s.label}</h3>
                  <p className="text-sm text-gray-500">{s.description}</p>
                </div>
              </div>
              <div className="text-2xl font-bold text-primary-600">
                {stats[s.statKey]}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        <Link href="/admin/calendar">
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <h3 className="text-lg font-semibold">School Calendar</h3>
                <p className="text-sm text-gray-500">
                  Configure school years, school days, holidays, and make-up days
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Card>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <h3 className="text-lg font-semibold">Lessons</h3>
              <p className="text-sm text-gray-500">
                {stats.lesson_count} lessons total — manage lessons from the{" "}
                <Link href="/lessons" className="text-primary-600 underline hover:text-primary-700">
                  Lessons
                </Link>{" "}
                page or{" "}
                <Link href="/week" className="text-primary-600 underline hover:text-primary-700">
                  Weekly Planner
                </Link>
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-2 text-lg font-semibold">Field Coverage</h3>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>
              <strong>Children:</strong> name, emoji, banner image editable in <Link href="/admin/children" className="text-primary-600 underline">Children</Link>.
            </li>
            <li>
              <strong>Subjects:</strong> name, color, thumbnail editable in <Link href="/admin/subjects" className="text-primary-600 underline">Subjects</Link>.
            </li>
            <li>
              <strong>Courses:</strong> name, description, subject, type, status, dates, notes, cover image editable in <Link href="/admin/curricula" className="text-primary-600 underline">Courses</Link>.
            </li>
            <li>
              <strong>Lessons:</strong> title, due date, status editable in <Link href="/lessons/table" className="text-primary-600 underline">Lessons Table</Link>; order index and timestamps are system-managed.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
