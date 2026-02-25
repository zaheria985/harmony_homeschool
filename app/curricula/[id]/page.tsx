import { redirect } from "next/navigation";

export default async function CurriculumDetailPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/curricula/${params.id}/board`);
}
