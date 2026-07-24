import BotanicalOrnament, {
  type OrnamentVariant,
} from "@/components/ui/BotanicalOrnament";

export default function EmptyState({
  message = "Nothing here yet",
  /** Optional invitation line under the message. */
  hint,
  icon,
  /** Botanical mark to use when no custom icon is supplied. */
  ornament = "sprig",
  children,
}: {
  message?: string;
  hint?: string;
  icon?: React.ReactNode;
  ornament?: OrnamentVariant;
  /** Call to action, e.g. a "Create course" button. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="text-interactive-border">
        {icon || <BotanicalOrnament variant={ornament} size={44} />}
      </div>
      <p className="mt-3 text-sm font-medium text-secondary">{message}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
