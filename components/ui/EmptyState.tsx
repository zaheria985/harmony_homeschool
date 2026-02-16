import { Inbox } from "lucide-react";

export default function EmptyState({
  message = "No data yet",
  icon,
}: {
  message?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[var(--border)]">
        {icon || <Inbox size={28} className="text-muted" />}
      </div>
      <p className="mt-3 text-sm">{message}</p>
    </div>
  );
}
