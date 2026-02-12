export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { getAllResourceTags, getResourceById } from "@/lib/queries/resources";
import { getAllLessons } from "@/lib/queries/lessons";
import {
  getAllBooklists,
  getBooklistsForResource,
} from "@/lib/queries/booklists";
import ResourceDetailClient from "@/components/resources/ResourceDetailClient";
export default async function ResourceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [resource, lessonsData, booklists, selectedBooklistIds, tags] =
    await Promise.all([
      getResourceById(params.id),
      getAllLessons(),
      getAllBooklists(),
      getBooklistsForResource(params.id),
      getAllResourceTags(),
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
    }),
  );
  return (
    <div>
      {" "}
      <PageHeader title={resource.title} />{" "}
      <ResourceDetailClient
        resource={resource}
        allLessons={allLessons}
        allTags={tags.map((tag: { name: string }) => tag.name)}
        booklists={booklists}
        initialBooklistIds={selectedBooklistIds}
      />{" "}
    </div>
  );
}
