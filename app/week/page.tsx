import { redirect } from "next/navigation";
import { getWeekStart } from "@/lib/utils/dates";
import { getChildren } from "@/lib/queries/week";

export const dynamic = "force-dynamic";

export default async function WeekRedirectPage() {
  const weekStart = getWeekStart(new Date());
  const children = await getChildren();
  const childParam = children[0]?.id ? `?child=${children[0].id}` : "";
  redirect(`/week/${weekStart}${childParam}`);
}
