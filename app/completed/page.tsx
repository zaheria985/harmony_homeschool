export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllChildren } from "@/lib/queries/students";
import {
  getAllSchoolYearsForReports,
  getCompletedLessons,
} from "@/lib/queries/reports";
import { getAllSubjects } from "@/lib/queries/admin";
import CompletedClient from "./CompletedClient";
import { getCurrentUser } from "@/lib/session";
export default async function CompletedPage({
  searchParams,
}: {
  searchParams: {
    child?: string;
    subject?: string;
    start?: string;
    end?: string;
    year?: string;
  };
}) {
  const user = await getCurrentUser();
  const [children, subjects, lessons, years] = await Promise.all([
    getAllChildren(user.role === "parent" ? user.id : undefined),
    getAllSubjects(),
    getCompletedLessons({
      childId: searchParams.child || undefined,
      subjectId: searchParams.subject || undefined,
      startDate: searchParams.start || undefined,
      endDate: searchParams.end || undefined,
      yearId: searchParams.year || undefined,
    }),
    getAllSchoolYearsForReports(),
  ]);
  return (
    <div>
      {" "}
      <div className="print:hidden">
        {" "}
        <PageHeader title="Completed Reports" />{" "}
      </div>{" "}
      <CompletedClient
        children={children.map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }))}
        subjects={subjects.map(
          (s: { id: string; name: string; color: string }) => ({
            id: s.id,
            name: s.name,
            color: s.color,
          }),
        )}
        years={years.map((y: { id: string; label: string }) => ({
          id: y.id,
          label: y.label,
        }))}
        lessons={lessons}
        filters={{
          child: searchParams.child || "",
          subject: searchParams.subject || "",
          start: searchParams.start || "",
          end: searchParams.end || "",
          year: searchParams.year || "",
        }}
      />{" "}
    </div>
  );
}
