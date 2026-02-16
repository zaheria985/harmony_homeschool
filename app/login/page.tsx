"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function normalizeCallbackUrl(rawCallbackUrl: string | null) {
  if (!rawCallbackUrl) return "/dashboard";
  try {
    const callbackUrl = decodeURIComponent(rawCallbackUrl).trim();
    const parsed = new URL(callbackUrl, "http://localhost");
    if (parsed.pathname === "/login") return "/dashboard";
    if (parsed.pathname.startsWith("//")) return "/dashboard";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/dashboard";
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = normalizeCallbackUrl(searchParams.get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      window.location.href = callbackUrl;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-light bg-surface p-8 shadow-warm">
          <h1 className="mb-1 font-display text-2xl text-primary">
            Harmony Homeschool
          </h1>
          <p className="mb-6 text-sm text-muted">
            Sign in to your account
          </p>
          {error && (
            <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-secondary"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-secondary"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-interactive py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-[var(--brand)] hover:underline">
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
