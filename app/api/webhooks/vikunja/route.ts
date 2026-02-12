import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import pool from "@/lib/db";
import { getMappingByVikunjaTaskId } from "@/lib/queries/vikunja-sync";
import { revalidatePath } from "next/cache";

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.VIKUNJA_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-vikunja-signature");

  if (process.env.VIKUNJA_WEBHOOK_SECRET && !verifySignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event as string;
  const data = payload.data as Record<string, unknown> | undefined;

  if (!data) {
    return NextResponse.json({ ok: true });
  }

  // Only handle task updates
  if (event !== "task.updated") {
    return NextResponse.json({ ok: true });
  }

  const vikunjaTaskId = data.id as number;
  if (!vikunjaTaskId) {
    return NextResponse.json({ ok: true });
  }

  const mapping = await getMappingByVikunjaTaskId(vikunjaTaskId);
  if (!mapping) {
    return NextResponse.json({ ok: true, message: "No mapping found" });
  }

  if (mapping.sync_type === "lesson" && mapping.lesson_id) {
    const done = data.done as boolean;

    if (done) {
      // Mark lesson complete
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const userRes = await client.query(
          "SELECT id FROM users WHERE role = 'parent' LIMIT 1"
        );
        const userId = userRes.rows[0]?.id;
        if (!userId) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "No parent user found" },
            { status: 500 }
          );
        }

        await client.query(
          `INSERT INTO lesson_completions (lesson_id, child_id, completed_by_user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (lesson_id, child_id) DO UPDATE
             SET completed_at = now()`,
          [mapping.lesson_id, mapping.child_id, userId]
        );

        await client.query(
          "UPDATE lessons SET status = 'completed' WHERE id = $1",
          [mapping.lesson_id]
        );

        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Webhook: failed to mark lesson complete", err);
        return NextResponse.json(
          { error: "Failed to update lesson" },
          { status: 500 }
        );
      } finally {
        client.release();
      }
    } else {
      // Unchecked — mark lesson incomplete
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "DELETE FROM lesson_completions WHERE lesson_id = $1 AND child_id = $2",
          [mapping.lesson_id, mapping.child_id]
        );
        await client.query(
          "UPDATE lessons SET status = 'planned' WHERE id = $1",
          [mapping.lesson_id]
        );
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Webhook: failed to mark lesson incomplete", err);
        return NextResponse.json(
          { error: "Failed to update lesson" },
          { status: 500 }
        );
      } finally {
        client.release();
      }
    }

    revalidatePath("/lessons");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
    revalidatePath("/grades");
    revalidatePath("/week");
  }

  return NextResponse.json({ ok: true });
}
