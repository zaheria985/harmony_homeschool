import { redirect } from "next/navigation";
import { getWeekStart } from "@/lib/utils/dates";
import { getChildren } from "@/lib/queries/week";
import { getCurrentUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function WeekRedirectPage() {
  const weekStart = getWeekStart(new Date());
  const user = await getCurrentUser();
  const children = await getChildren(
    user.role === "parent" ? user.id : undefined,
  );
  const childParam = children[0]?.id ? `?child=${children[0].id}` : "";
  redirect(`/week/${weekStart}${childParam}`);
}
