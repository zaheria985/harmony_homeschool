export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { getResourceById } from "@/lib/queries/resources";
import { getAllLessons } from "@/lib/queries/lessons";
import ResourceDetailClient from "@/components/resources/ResourceDetailClient";

export default async function ResourceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [resource, lessonsData] = await Promise.all([
    getResourceById(params.id),
    getAllLessons(),
  ]);

  if (!resource) notFound();

  const allLessons = lessonsData.map(
    (l: {
      id: string;
      title: string;
      child_name: string;
      subject_name: string;
    }) => ({
      id: l.id,
      title: l.title,
      child_name: l.child_name,
      subject_name: l.subject_name,
    })
  );

  return (
    <div>
      <PageHeader title={resource.title} />
      <ResourceDetailClient resource={resource} allLessons={allLessons} />
    </div>
  );
}
