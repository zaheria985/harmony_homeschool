export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";
import CurriculumBoard from "@/components/curricula/CurriculumBoard";
import { CurriculumViewToggle } from "@/components/curricula/CurriculumViewToggle";
import { getCurriculumBoardData } from "@/lib/queries/curricula";
export default async function CurriculumBoardPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getCurriculumBoardData(params.id);
  if (!data) notFound();
  return (
    <div>
      {" "}
      {data.cover_image && (
        <div className="mb-6 h-48 overflow-hidden rounded-xl">
          {" "}
          {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
          <img
            src={data.cover_image}
            alt={data.name}
            className="h-full w-full object-cover"
          />{" "}
        </div>
      )}{" "}
      <PageHeader title={data.name}>
        {" "}
        <div className="flex items-center gap-2">
          {" "}
          <CurriculumViewToggle curriculumId={params.id} />{" "}
          <Link
            href={`/subjects/${data.subject_id}`}
            className="rounded-lg border px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
          >
            {" "}
            Back to {data.subject_name}{" "}
          </Link>{" "}
        </div>{" "}
      </PageHeader>{" "}
      <div className="mb-6 flex items-center gap-3">
        {" "}
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: data.subject_color }}
        />{" "}
        <span className="text-sm text-muted">
          {" "}
          <Link
            href={`/subjects/${data.subject_id}`}
            className="text-interactive hover:underline"
          >
            {" "}
            {data.subject_name}{" "}
          </Link>{" "}
          {" ·"}{" "}
          <Link
            href={`/students/${data.child_id}`}
            className="text-interactive hover:underline"
          >
            {" "}
            {data.child_name}{" "}
          </Link>{" "}
          {" ·"} {data.children.length} student
          {data.children.length !== 1 ? "s" : ""} assigned{" "}
        </span>{" "}
      </div>{" "}
      <CurriculumBoard
        curriculumId={data.id}
        subjectColor={data.subject_color}
        lessons={data.lessons}
        children={data.children}
        curriculumResources={data.curriculumResources}
      />{" "}
    </div>
  );
}
