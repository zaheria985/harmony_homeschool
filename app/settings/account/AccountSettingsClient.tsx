"use client";

import { useState } from "react";
import { updateEmail, updatePassword } from "@/lib/actions/auth";

function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p className="rounded-lg bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-solid)]">
        {error}
      </p>
    );
  if (success)
    return (
      <p className="rounded-lg bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success-solid)]">
        {success}
      </p>
    );
  return null;
}

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--app-text)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20";

const labelClass = "block text-sm font-medium text-[var(--app-text)] mb-1";

const buttonClass =
  "rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-contrast)] hover:opacity-90 transition-opacity disabled:opacity-50";

export default function AccountSettingsClient({
  userId,
  currentEmail,
}: {
  userId: string;
  currentEmail: string;
}) {
  const [emailState, setEmailState] = useState({ error: "", success: "" });
  const [passwordState, setPasswordState] = useState({
    error: "",
    success: "",
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailState({ error: "", success: "" });
    setEmailLoading(true);
    const form = new FormData(e.currentTarget);
    form.set("userId", userId);
    const result = await updateEmail(form);
    setEmailLoading(false);
    if (result.error) {
      setEmailState({ error: result.error, success: "" });
    } else {
      setEmailState({ error: "", success: "Email updated successfully." });
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordState({ error: "", success: "" });
    setPasswordLoading(true);
    const form = new FormData(e.currentTarget);
    form.set("userId", userId);
    const result = await updatePassword(form);
    setPasswordLoading(false);
    if (result.error) {
      setPasswordState({ error: result.error, success: "" });
    } else {
      setPasswordState({
        error: "",
        success: "Password updated successfully.",
      });
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      {/* Change Email */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <h2 className="font-display text-lg text-[var(--app-text)] mb-4">
          Change Email
        </h2>
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="newEmail" className={labelClass}>
              New Email
            </label>
            <input
              id="newEmail"
              name="newEmail"
              type="email"
              required
              defaultValue={currentEmail}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="emailCurrentPassword" className={labelClass}>
              Current Password
            </label>
            <input
              id="emailCurrentPassword"
              name="currentPassword"
              type="password"
              required
              placeholder="Verify your identity"
              className={inputClass}
            />
          </div>
          <FormMessage error={emailState.error} success={emailState.success} />
          <button type="submit" disabled={emailLoading} className={buttonClass}>
            {emailLoading ? "Updating..." : "Update Email"}
          </button>
        </form>
      </section>

      {/* Change Password */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card-bg)] p-6">
        <h2 className="font-display text-lg text-[var(--app-text)] mb-4">
          Change Password
        </h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="pwCurrentPassword" className={labelClass}>
              Current Password
            </label>
            <input
              id="pwCurrentPassword"
              name="currentPassword"
              type="password"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="newPassword" className={labelClass}>
              New Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className={labelClass}>
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className={inputClass}
            />
          </div>
          <FormMessage
            error={passwordState.error}
            success={passwordState.success}
          />
          <button
            type="submit"
            disabled={passwordLoading}
            className={buttonClass}
          >
            {passwordLoading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  );
}
