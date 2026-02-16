"use client";
import { useEffect } from "react";
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] p-6 text-center">
      {" "}
      <h2 className="text-xl font-semibold text-[var(--error-text)]">
        Something went wrong
      </h2>{" "}
      <p className="text-sm text-[var(--error-text)]">
        {" "}
        We hit an unexpected error while rendering this page.{" "}
      </p>{" "}
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-[var(--error-text)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        {" "}
        Try again{" "}
      </button>{" "}
    </div>
  );
}
