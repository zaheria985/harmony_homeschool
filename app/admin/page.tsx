export const dynamic = "force-dynamic";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { getAdminStats, getArchiveStats } from "@/lib/queries/admin";
import LessonArchiveCard from "@/components/admin/LessonArchiveCard";

const sections = [
  {
    href: "/admin/children",
    label: "Student Management",
    icon: "👨‍🎓",
    description: "Add and manage student profiles",
    statKey: "child_count" as const,
  },
];

export default async function AdminPage() {
  const [stats, archiveStats] = await Promise.all([
    getAdminStats(),
    getArchiveStats(),
  ]);
  return (
    <div>
      <PageHeader title="Admin" />

      <div className="mb-8 rounded-lg border border-primary-100 bg-interactive-light p-4 text-sm text-primary-800">
        <strong>Configuration &amp; tools:</strong> Use this page for calendar
        setup, imports, tag management, and reporting tools. Day-to-day content
        management for subjects and curricula is available directly from the
        sidebar.
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold">{s.label}</h3>
                  <p className="text-sm text-muted">{s.description}</p>
                </div>
              </div>
              <div className="font-display text-2xl text-interactive">
                {stats[s.statKey]}
              </div>
            </Card>
          </Link>
        ))}

        <Link href="/admin/users">
          <Card className="transition-shadow hover:shadow-md">
            <div className="mb-3 flex items-center gap-3">
              <span className="text-2xl">🔑</span>
              <div>
                <h3 className="text-lg font-semibold">
                  User &amp; Permission Management
                </h3>
                <p className="text-sm text-muted">
                  Manage user accounts and permission levels
                </p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        <Link href="/admin/calendar">
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📅</span>
              <div>
                <h3 className="text-lg font-semibold">School Calendar</h3>
                <p className="text-sm text-muted">
                  Configure school years, school days, holidays, and make-up
                  days
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/admin/external-events">
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏫</span>
              <div>
                <h3 className="text-lg font-semibold">
                  External School Events
                </h3>
                <p className="text-sm text-muted">
                  Import and manage recurring external program dates for
                  calendar visibility
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/admin/lessons">
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📥</span>
              <div>
                <h3 className="text-lg font-semibold">
                  Bulk Import Lessons
                </h3>
                <p className="text-sm text-muted">
                  Paste lessons from a spreadsheet to create many at once
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/admin/trello">
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <h3 className="text-lg font-semibold">
                  Import from Trello
                </h3>
                <p className="text-sm text-muted">
                  Import a Trello board as a curriculum with chapters, lessons,
                  and resources
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/tags">
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🏷️</span>
              <div>
                <h3 className="text-lg font-semibold">Tag Management</h3>
                <p className="text-sm text-muted">
                  Rename, merge, and delete tags used in the resource
                  library
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/completed">
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="text-lg font-semibold">
                  Completed Reports
                </h3>
                <p className="text-sm text-muted">
                  Review completed lessons by student, subject, date range, and
                  school year
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/grades">
          <Card className="transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="text-lg font-semibold">Grades</h3>
                <p className="text-sm text-muted">
                  View and manage gradebook records for completed lessons
                </p>
              </div>
            </div>
          </Card>
        </Link>

        <LessonArchiveCard
          archivableCount={archiveStats.archivable_count}
          archivedCount={archiveStats.archived_count}
          byYear={archiveStats.byYear}
        />

        <Card className="transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💾</span>
            <div>
              <h3 className="text-lg font-semibold">Data Export</h3>
              <p className="mb-2 text-sm text-muted">
                Download all data for backup or migration
              </p>
              <div className="flex gap-2">
                <a
                  href="/api/export?format=json"
                  className="rounded-lg bg-interactive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Export JSON
                </a>
                <a
                  href="/api/export?format=csv"
                  className="rounded-lg border border-light bg-surface px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface-muted"
                >
                  Export CSV
                </a>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-2 text-lg font-semibold">Moved to Sidebar</h3>
          <p className="text-sm text-muted">
            The following are now managed directly from their sidebar pages:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-tertiary">
            <li>
              <strong>Subjects:</strong> Manage subjects from the{" "}
              <Link
                href="/subjects"
                className="text-interactive underline hover:text-interactive-hover"
              >
                Subjects
              </Link>{" "}
              page.
            </li>
            <li>
              <strong>Courses:</strong> Manage courses from the{" "}
              <Link
                href="/curricula"
                className="text-interactive underline hover:text-interactive-hover"
              >
                Curricula
              </Link>{" "}
              page.
            </li>
            <li>
              <strong>Lessons:</strong> Manage lessons from the{" "}
              <Link
                href="/lessons/table"
                className="text-interactive underline hover:text-interactive-hover"
              >
                Lessons Table
              </Link>{" "}
              or{" "}
              <Link
                href="/week"
                className="text-interactive underline hover:text-interactive-hover"
              >
                Weekly Planner
              </Link>
              .
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
