export default function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  /** One-line, data-bearing summary shown under the title. */
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl text-primary">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm italic text-tertiary">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
