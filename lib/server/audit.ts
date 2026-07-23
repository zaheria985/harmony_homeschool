import type { PoolClient } from "pg";
import pool from "@/lib/db";

/**
 * Append-only audit trail.
 *
 * Pass a transaction client when the audited mutation runs in one, so the log
 * entry commits or rolls back with the change it describes — a log row for a
 * rolled-back approval would be worse than no row at all.
 */

export type AuditEntry = {
  actorUserId: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
};

export async function recordAudit(
  entry: AuditEntry,
  client?: PoolClient,
): Promise<void> {
  const executor = client ?? pool;
  try {
    await executor.query(
      `INSERT INTO audit_log (actor_user_id, actor_name, action, entity_type, entity_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        entry.actorUserId,
        entry.actorName ?? null,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        JSON.stringify(entry.detail ?? {}),
      ],
    );
  } catch (err) {
    // Outside a transaction, auditing must never break the user's action.
    // Inside one, rethrow so the caller's rollback covers both.
    if (client) throw err;
    console.error("[audit] failed to record entry", entry.action, err);
  }
}
