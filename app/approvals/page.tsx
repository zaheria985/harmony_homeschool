export const dynamic = "force-dynamic";

import { getPendingCompletions } from "@/lib/actions/completions";
import PageHeader from "@/components/ui/PageHeader";
import ApprovalsClient from "@/components/approvals/ApprovalsClient";

export default async function ApprovalsPage() {
  const pending = await getPendingCompletions();
  return (
    <div>
      <PageHeader title="Pending Approvals" />
      <ApprovalsClient pending={pending} />
    </div>
  );
}
