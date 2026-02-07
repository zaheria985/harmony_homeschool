export default function ProgressBar({
  value,
  max = 100,
  color = "primary",
  showLabel = true,
}: {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const bgColor =
    color === "success"
      ? "bg-success-500"
      : color === "warning"
        ? "bg-warning-500"
        : "bg-primary-500";

  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${bgColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-gray-600">{pct}%</span>
      )}
    </div>
  );
}
