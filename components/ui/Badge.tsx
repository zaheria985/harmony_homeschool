const variants: Record<string, string> = {
  default: "bg-gray-100 text-gray-700",
  primary: "bg-primary-100 text-primary-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
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
      {children}
    </span>
  );
}
