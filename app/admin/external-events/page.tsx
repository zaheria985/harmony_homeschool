export const dynamic = "force-dynamic";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { getAllChildren } from "@/lib/queries/students";
import { getExternalEventsForAdmin } from "@/lib/queries/external-events";
import ExternalEventsClient from "./ExternalEventsClient";
import { getCurrentUser } from "@/lib/session";
export default async function ExternalEventsPage() {
  const user = await getCurrentUser();
  const [children, events] = await Promise.all([
    getAllChildren(user.role === "parent" ? user.id : undefined),
    getExternalEventsForAdmin(user.role === "parent" ? user.id : undefined),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="External School Events">
        {" "}
        <Link
          href="/admin"
          className="rounded-lg border px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
        >
          {" "}
          Back to Admin{" "}
        </Link>{" "}
      </PageHeader>{" "}
      <ExternalEventsClient
        children={children.map((child: { id: string; name: string }) => ({
          id: child.id,
          name: child.name,
        }))}
        events={events}
      />{" "}
    </div>
  );
}
