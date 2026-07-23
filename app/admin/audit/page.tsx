export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

type AuditRow = {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  approve_completion: "Approved completion",
  reject_completion: "Rejected completion",
  create_kid_account: "Created student account",
  update_kid_permission: "Changed permissions",
  reset_kid_password: "Reset password",
  delete_kid_account: "Deleted student account",
};

const PAGE_SIZE = 100;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: { action?: string };
}) {
  const user = await getCurrentUser();
  if (user.role !== "parent") {
    return <EmptyState message="The audit log is only visible to parents." />;
  }

  const actionFilter = searchParams?.action || "";

  const res = await pool.query(
    `SELECT a.id::text, a.actor_name, u.email AS actor_email, a.action,
            a.entity_type, a.entity_id::text, a.detail,
            to_char(a.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE ($1 = '' OR a.action = $1)
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [actionFilter, PAGE_SIZE],
  );
  const rows = res.rows as AuditRow[];

  const actionsRes = await pool.query(
    "SELECT DISTINCT action FROM audit_log ORDER BY action",
  );
  const actions = (actionsRes.rows as { action: string }[]).map((r) => r.action);

  return (
    <div>
      <PageHeader title="Audit Log" />

      <p className="mb-4 text-sm text-muted">
        Who approved, changed, or removed what. Records are append-only and are
        kept even if the account that made the change is later deleted.
      </p>

      {actions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/admin/audit"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              actionFilter === ""
                ? "bg-interactive text-white"
                : "border border-light text-secondary hover:text-interactive"
            }`}
          >
            All
          </Link>
          {actions.map((action) => (
            <Link
              key={action}
              href={`/admin/audit?action=${action}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                actionFilter === action
                  ? "bg-interactive text-white"
                  : "border border-light text-secondary hover:text-interactive"
              }`}
            >
              {ACTION_LABELS[action] || action}
            </Link>
          ))}
        </div>
      )}

      <Card title="">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing recorded yet. Approvals and account changes will appear
            here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-light text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Who</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-light last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3 text-muted">
                      {row.created_at}
                    </td>
                    <td className="py-2 pr-3 text-primary">
                      {row.actor_email || row.actor_name || (
                        <span className="text-muted">deleted account</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-primary">
                      {ACTION_LABELS[row.action] || row.action}
                    </td>
                    <td className="py-2 text-xs text-muted">
                      {Object.entries(row.detail || {})
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === PAGE_SIZE && (
              <p className="mt-3 text-xs text-muted">
                Showing the most recent {PAGE_SIZE} entries.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
