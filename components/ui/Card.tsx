export default function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-light bg-surface p-6 shadow-warm ${className}`}
    >
      {title && (
        <h3 className="mb-4 font-display text-lg text-primary">{title}</h3>
      )}
      {children}
    </div>
  );
}
