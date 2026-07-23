/**
 * Shared skeleton primitives for route-level `loading.tsx` files.
 *
 * These render a silhouette of the page rather than a spinner, so the layout
 * does not jump when real content arrives.
 */

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-interactive-light ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="mb-8">
      <SkeletonBlock className="h-8 w-48" />
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-light bg-surface p-4 shadow-warm">
      <SkeletonBlock className="mb-3 h-4 w-1/3" />
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, i) => (
          <SkeletonBlock
            key={i}
            className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Wraps a route skeleton. `role="status"` plus an off-screen label means a
 * screen reader announces the load instead of reading a wall of empty boxes.
 */
export function SkeletonScreen({
  label = "Loading",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
