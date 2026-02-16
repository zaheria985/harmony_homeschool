export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import pool from "@/lib/db";
import Link from "next/link";
import CreateKidAccountForm from "./CreateKidAccountForm";
import DeleteKidButton from "./DeleteKidButton";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || user.role === "kid") {
    redirect("/dashboard");
  }

  const kidAccountsRes = await pool.query(
    `SELECT u.id, u.name, u.email, c.name as child_name
     FROM users u
     LEFT JOIN children c ON u.child_id = c.id
     WHERE u.role = 'kid'
     ORDER BY u.name`
  );
  const kidAccounts = kidAccountsRes.rows;

  const childrenRes = await pool.query(
    "SELECT id, name FROM children ORDER BY name"
  );
  const children = childrenRes.rows;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="font-display text-2xl text-primary">User Management</h1>
      <p className="text-sm text-muted">
        Create and manage kid accounts so your children can log in and view their lessons.
      </p>

      {children.length === 0 ? (
        <div className="rounded-xl border border-light bg-surface p-6 text-center">
          <p className="text-sm text-muted">
            No children found.{" "}
            <Link href="/students" className="text-[var(--brand)] hover:underline">
              Add a child first
            </Link>{" "}
            before creating kid accounts.
          </p>
        </div>
      ) : (
        <CreateKidAccountForm children={children} />
      )}

      <div className="rounded-xl border border-light bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-primary">Kid Accounts</h2>
        {kidAccounts.length === 0 ? (
          <p className="text-sm text-muted">No kid accounts yet.</p>
        ) : (
          <div className="space-y-3">
            {kidAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium text-primary">{account.name}</p>
                  <p className="text-xs text-muted">{account.email}</p>
                  {account.child_name && (
                    <p className="text-xs text-muted">Linked to: {account.child_name}</p>
                  )}
                </div>
                <DeleteKidButton userId={account.id} userName={account.name} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
