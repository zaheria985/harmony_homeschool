"use client";

import { useState, useTransition } from "react";
import { resetKidPassword } from "@/lib/actions/auth";

export default function ResetPasswordButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters");
      return;
    }
    setMessage("");
    startTransition(async () => {
      const result = await resetKidPassword(userId, newPassword);
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage("Password reset successfully");
        setNewPassword("");
        setTimeout(() => {
          setShowForm(false);
          setMessage("");
        }, 2000);
      }
    });
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="rounded border px-2 py-1 text-xs text-secondary hover:bg-surface-muted"
      >
        Reset Password
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        placeholder={`New password for ${userName}`}
        minLength={8}
        required
        autoComplete="new-password"
        className="w-40 rounded-md border border-border bg-surface px-2 py-1 text-xs text-primary focus:outline-none focus:ring-1 focus:ring-focus"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-interactive px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => { setShowForm(false); setMessage(""); }}
        className="text-xs text-muted hover:text-primary"
      >
        Cancel
      </button>
      {message && (
        <span className={`text-xs ${message.includes("success") ? "text-emerald-600" : "text-red-600"}`}>
          {message}
        </span>
      )}
    </form>
  );
}
