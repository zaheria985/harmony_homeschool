"use client";

import { useState } from "react";
import { createKidAccount } from "@/lib/actions/auth";

interface Child {
  id: string;
  name: string;
}

export default function CreateKidAccountForm({ children }: { children: Child[] }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await createKidAccount(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setSuccess("Kid account created successfully");
    setLoading(false);
    (e.target as HTMLFormElement).reset();
  }

  return (
    <div className="rounded-xl border border-light bg-surface p-6">
      <h2 className="mb-4 text-lg font-semibold text-primary">Create Kid Account</h2>
      {error && (
        <div className="mb-4 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {success}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="childId" className="block text-sm font-medium text-secondary">
            Child
          </label>
          <select
            id="childId"
            name="childId"
            required
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          >
            <option value="">Select a child...</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kid-email" className="block text-sm font-medium text-secondary">
            Email
          </label>
          <input
            id="kid-email"
            name="email"
            type="email"
            required
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          />
        </div>
        <div>
          <label htmlFor="kid-password" className="block text-sm font-medium text-secondary">
            Password
          </label>
          <input
            id="kid-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          />
        </div>
        <div>
          <label htmlFor="kid-permission" className="block text-sm font-medium text-secondary">
            Permission Level
          </label>
          <select
            id="kid-permission"
            name="permissionLevel"
            defaultValue="full"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          >
            <option value="full">Full Access</option>
            <option value="mark_complete">Mark Complete Only</option>
            <option value="view_only">View Only</option>
          </select>
          <p className="mt-1 text-xs text-muted">
            Full: can do everything. Mark Complete: can only mark lessons done (requires approval). View Only: read-only access.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}
