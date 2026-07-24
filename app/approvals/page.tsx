export const dynamic = "force-dynamic";

import { getPendingCompletions } from "@/lib/actions/completions";
import PageHeader from "@/components/ui/PageHeader";
import ApprovalsClient from "@/components/approvals/ApprovalsClient";
import { getChildRoster } from "@/lib/queries/students";
import { kidColorMap } from "@/lib/utils/kid-colors";

export default async function ApprovalsPage() {
  const [pending, roster] = await Promise.all([
    getPendingCompletions(),
    getChildRoster(),
  ]);
  return (
    <div>
      <PageHeader
        title="Pending Approvals"
        subtitle={
          pending.length === 0
            ? "Nothing waiting"
            : `${pending.length} ${pending.length === 1 ? "completion" : "completions"} waiting`
        }
      />
      <ApprovalsClient pending={pending} colors={kidColorMap(roster)} />
    </div>
  );
}
