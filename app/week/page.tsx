import { redirect } from "next/navigation";
import { getWeekStart, parseDate } from "@/lib/utils/dates";
import { todayKey } from "@/lib/utils/timezone";
import { getChildren } from "@/lib/queries/week";
import { getCurrentUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function WeekRedirectPage() {
  // Resolve "today" in the configured app timezone, not the container's.
  const weekStart = getWeekStart(parseDate(todayKey()));
  const user = await getCurrentUser();
  const children = await getChildren(
    user.role === "parent" ? user.id : undefined,
  );
  const childParam = children[0]?.id ? `?child=${children[0].id}` : "";
  redirect(`/week/${weekStart}${childParam}`);
}
