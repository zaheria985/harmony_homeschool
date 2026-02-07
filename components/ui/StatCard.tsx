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
      className={`rounded-xl border border-gray-200 border-l-4 bg-white p-6 shadow-sm ${colorClasses[color]}`}
    >
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sublabel && <p className="mt-1 text-sm text-gray-400">{sublabel}</p>}
    </div>
  );
}
