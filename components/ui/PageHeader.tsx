export default function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
