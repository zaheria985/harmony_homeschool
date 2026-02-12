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
      ? "bg-[var(--success-solid)]"
      : color === "warning"
        ? "bg-[var(--warning-solid)]"
        : "bg-primary-500";
  return (
    <div className="flex items-center gap-3">
      {" "}
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
        {" "}
        <div
          className={`h-full rounded-full transition-all ${bgColor}`}
          style={{ width: `${pct}%` }}
        />{" "}
      </div>{" "}
      {showLabel && (
        <span className="text-sm font-medium text-tertiary">{pct}%</span>
      )}{" "}
    </div>
  );
}
