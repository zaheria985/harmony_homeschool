import Link from "next/link";
import { signupAvailability } from "@/lib/server/signup-policy";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const availability = await signupAvailability();

  if (!availability.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-light bg-surface p-8 shadow-warm text-center">
            <h1 className="mb-1 font-display text-2xl text-primary">
              Signup is disabled
            </h1>
            <p className="mb-6 text-sm text-muted">
              This Harmony instance is not accepting new accounts. Ask your
              family administrator to create one for you.
            </p>
            <Link
              href="/login"
              className="text-[var(--brand)] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <SignupForm requiresInviteCode={availability.requiresInviteCode} />;
}
