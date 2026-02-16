export default function EmptyState({
  message = "No data yet",
  icon = "📭",
}: {
  message?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted">
      {" "}
      <span className="text-4xl">{icon}</span>{" "}
      <p className="mt-2 text-sm">{message}</p>{" "}
    </div>
  );
}
