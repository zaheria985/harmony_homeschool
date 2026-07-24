"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BotanicalOrnament from "@/components/ui/BotanicalOrnament";

function normalizeCallbackUrl(rawCallbackUrl: string | null) {
  if (!rawCallbackUrl) return "/today";
  try {
    const callbackUrl = decodeURIComponent(rawCallbackUrl).trim();
    const parsed = new URL(callbackUrl, "http://localhost");
    if (parsed.pathname === "/login") return "/today";
    if (parsed.pathname.startsWith("//")) return "/today";
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/today";
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = normalizeCallbackUrl(searchParams.get("callbackUrl"));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupAllowed, setSignupAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/signup-status")
      .then((res) => (res.ok ? res.json() : { allowed: false }))
      .then((data) => {
        if (active) setSignupAllowed(Boolean(data.allowed));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-card border border-light bg-surface p-8 shadow-warm-lg">
          <div className="mb-1 flex justify-center text-interactive-border">
            <BotanicalOrnament variant="sprig" size={44} />
          </div>
          <h1 className="text-center font-display text-2xl text-[var(--brand)]">
            Harmony
          </h1>
          <p className="mb-6 text-center text-sm italic text-tertiary">
            Homeschool, gathered in one place
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
              className="min-h-[44px] w-full rounded-xl bg-interactive text-sm font-medium text-[var(--brand-contrast)] transition-colors hover:bg-interactive-hover disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {signupAllowed && (
            <p className="mt-4 text-center text-sm text-muted">
              Don&apos;t have an account?{" "}
              <a href="/signup" className="text-[var(--brand)] hover:underline">
                Create one
              </a>
            </p>
          )}
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
