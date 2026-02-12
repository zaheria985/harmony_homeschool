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
    primary: "border-l-primary-500",
    success: "border-l-success-500",
    warning: "border-l-warning-500",
  };
  return (
    <div
      className={`rounded-xl border border-light border-l-4 bg-surface p-6 shadow-sm ${colorClasses[color]}`}
    >
      {" "}
      <p className="text-sm font-medium text-muted dark:text-slate-400">
        {label}
      </p>{" "}
      <p className="mt-1 text-3xl font-bold text-primary">{value}</p>{" "}
      {sublabel && (
        <p className="mt-1 text-sm text-gray-400 dark:text-slate-500">
          {sublabel}
        </p>
      )}{" "}
    </div>
  );
}
