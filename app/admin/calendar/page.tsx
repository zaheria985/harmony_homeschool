export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";
import {
  getCurriculumScheduleExceptions,
  getSchoolYearsWithConfig,
} from "@/lib/queries/admin";
import CalendarConfigClient from "./CalendarConfigClient";
export default async function CalendarConfigPage() {
  const [schoolYears, scheduleExceptions] = await Promise.all([
    getSchoolYearsWithConfig(),
    getCurriculumScheduleExceptions(),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="School Calendar">
        {" "}
        <Link
          href="/admin"
          className="rounded-lg border px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
        >
          {" "}
          Back to Admin{" "}
        </Link>{" "}
      </PageHeader>{" "}
      <CalendarConfigClient
        schoolYears={schoolYears}
        scheduleExceptions={scheduleExceptions}
      />{" "}
    </div>
  );
}
