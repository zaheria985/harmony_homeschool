export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import GradingScaleEditor from "@/components/grades/GradingScaleEditor";
import { getGradingScales } from "@/lib/actions/grades";

export default async function SettingsPage() {
  const scales = await getGradingScales();

  return (
    <div>
      <PageHeader title="Settings" />

      <Card title="Grading Scales">
        <p className="mb-4 text-sm text-muted">
          Configure letter grade thresholds. The default scale is used to display
          letter grades on the Grades page.
        </p>
        <GradingScaleEditor scales={scales} />
      </Card>
    </div>
  );
}
