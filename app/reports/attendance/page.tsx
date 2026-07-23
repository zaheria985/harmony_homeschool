export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import EmptyState from "@/components/ui/EmptyState";
import { getAllChildren } from "@/lib/queries/students";
import { getAllSchoolYearsForReports } from "@/lib/queries/reports";
import { getAttendanceSummary } from "@/lib/queries/attendance";
import { getCurrentUser } from "@/lib/session";
import AttendanceSettings from "@/components/reports/AttendanceSettings";
import AttendanceDayRow from "@/components/reports/AttendanceDayRow";

type Child = { id: string; name: string };
type SchoolYear = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
};

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams?: { student?: string; year?: string };
}) {
  const user = await getCurrentUser();
  if (user.role !== "parent") {
    return (
      <EmptyState message="Attendance reports are only visible to parents." />
    );
  }

  const [children, schoolYears] = await Promise.all([
    getAllChildren(user.id) as Promise<Child[]>,
    getAllSchoolYearsForReports() as Promise<SchoolYear[]>,
  ]);

  if (children.length === 0) {
    return (
      <EmptyState message="Add a student to start tracking attendance." />
    );
  }

  const selectedChild =
    children.find((c) => c.id === searchParams?.student) || children[0];
  const selectedYear =
    schoolYears.find((y) => y.id === searchParams?.year) || schoolYears[0];

  if (!selectedYear) {
    return (
      <EmptyState message="Create a school year in Admin before running attendance reports." />
    );
  }

  const summary = await getAttendanceSummary(
    selectedChild.id,
    selectedYear.start_date,
    selectedYear.end_date,
  );

  const csvHref = `/api/reports/attendance?childId=${selectedChild.id}&start=${selectedYear.start_date}&end=${selectedYear.end_date}&format=csv`;

  return (
    <div>
      <PageHeader title="Attendance & Hours" />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {children.length > 1 &&
          children.map((child) => (
            <Link
              key={child.id}
              href={`/reports/attendance?student=${child.id}&year=${selectedYear.id}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                child.id === selectedChild.id
                  ? "bg-interactive text-white"
                  : "border border-light text-secondary hover:text-interactive"
              }`}
            >
              {child.name}
            </Link>
          ))}
        {schoolYears.length > 1 && (
          <span className="ml-auto flex flex-wrap gap-2">
            {schoolYears.map((year) => (
              <Link
                key={year.id}
                href={`/reports/attendance?student=${selectedChild.id}&year=${year.id}`}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  year.id === selectedYear.id
                    ? "bg-interactive text-white"
                    : "border border-light text-secondary hover:text-interactive"
                }`}
              >
                {year.label}
              </Link>
            ))}
          </span>
        )}
      </div>

      {!summary ? (
        <EmptyState message="Nothing to report yet." />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Days attended"
              value={summary.daysAttended}
              sublabel={selectedYear.label}
              color="primary"
            />
            <StatCard
              label="Instructional hours"
              value={summary.totalHours}
              sublabel={`${summary.totalMinutes} minutes`}
              color="success"
            />
            <StatCard
              label="Minutes per day"
              value={summary.defaultMinutesPerDay}
              sublabel="default credit"
              color="primary"
            />
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <AttendanceSettings
              currentMinutes={summary.defaultMinutesPerDay}
            />
            <a
              href={csvHref}
              className="rounded-lg border border-light px-3 py-2 text-sm text-secondary hover:border-interactive-border hover:text-interactive"
            >
              Export CSV
            </a>
          </div>

          <Card title={`${summary.childName} — ${selectedYear.label}`}>
            <p className="mb-4 text-sm text-muted">
              Days are counted automatically when a lesson scheduled for that
              day is completed. Use the controls on a row to record an absence,
              a holiday, or a different number of minutes.
            </p>

            {summary.days.length === 0 ? (
              <p className="text-sm text-muted">
                No completed lessons in this school year yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-light text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Lessons</th>
                      <th className="py-2 pr-3">Minutes</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.days.map((day) => (
                      <AttendanceDayRow
                        key={day.date}
                        childId={selectedChild.id}
                        day={day}
                        defaultMinutes={summary.defaultMinutesPerDay}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
