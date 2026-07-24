import { redirect } from "next/navigation";

/** The dashboard became the Today command center; keep old links working. */
export default function DashboardPage() {
  redirect("/today");
}
