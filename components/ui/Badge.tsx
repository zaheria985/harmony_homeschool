const variants: Record<string, string> = {
  default: "bg-surface-subtle text-secondary",
  primary:
    "bg-interactive-medium text-interactive-hover/50 dark:text-primary-200",
  success:
    "bg-[var(--success-bg)] text-[var(--success-text)] dark:bg-emerald-900/50 dark:text-emerald-200",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]/50",
  danger: "bg-red-100 text-red-700/50",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200",
};
export default function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant] || variants.default}`}
    >
      {" "}
      {children}{" "}
    </span>
  );
}
