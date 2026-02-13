"use client";

import { useState } from "react";
import { deleteKidAccount } from "@/lib/actions/auth";

export default function DeleteKidButton({ userId, userName }: { userId: string; userName: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete account for ${userName}? This cannot be undone.`)) return;
    setLoading(true);
    await deleteKidAccount(userId);
    setLoading(false);
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
    >
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}
