export default function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <h1 className="font-display text-3xl text-primary">{title}</h1>
      {children && (
        <div className="flex items-center gap-2">{children}</div>
      )}
    </div>
  );
}
