export default function StatCard({
  label,
  value,
  sublabel,
  color = "primary",
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  color?: "primary" | "success" | "warning";
}) {
  const colorClasses = {
    primary: "border-l-[var(--interactive)]",
    success: "border-l-[var(--success-solid)]",
    warning: "border-l-[var(--warning-solid)]",
  };
  return (
    <div
      className={`rounded-2xl border border-light border-l-4 bg-surface p-6 shadow-warm ${colorClasses[color]}`}
    >
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl text-primary">{value}</p>
      {sublabel && (
        <p className="mt-1 text-sm text-muted">{sublabel}</p>
      )}
    </div>
  );
}
