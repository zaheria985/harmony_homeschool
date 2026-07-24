export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Covers the app shell the root layout renders behind it.
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-[var(--app-bg)]">
      {children}
    </div>
  );
}
