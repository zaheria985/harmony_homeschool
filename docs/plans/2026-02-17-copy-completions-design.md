# Copy Completions to Another Child — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a smart banner to the curriculum detail page that detects completion mismatches between children sharing a curriculum and offers one-click copying.

**Architecture:** New query detects mismatches, new server action copies completions, new client component renders the banner. The curriculum detail page fetches mismatch data alongside existing data and passes it to the banner.

**Tech Stack:** Next.js 14 server actions, PostgreSQL (pg driver, parameterized SQL), React client component, Tailwind CSS

---

### Task 1: Add `getCompletionMismatches` query

**Files:**
- Modify: `lib/queries/curricula.ts`

**Step 1: Add the query function**

Append to `lib/queries/curricula.ts`:

```typescript
export async function getCompletionMismatches(curriculumId: string) {
  const res = await pool.query(
    `WITH assigned_children AS (
       SELECT ca.child_id, c.name AS child_name
       FROM curriculum_assignments ca
       JOIN children c ON c.id = ca.child_id
       WHERE ca.curriculum_id = $1
     ),
     child_completions AS (
       SELECT ac.child_id, ac.child_name, l.id AS lesson_id
       FROM assigned_children ac
       CROSS JOIN lessons l
       LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = ac.child_id
       WHERE l.curriculum_id = $1 AND lc.id IS NOT NULL
     ),
     completion_counts AS (
       SELECT child_id, child_name, COUNT(*) AS completed_count
       FROM child_completions
       GROUP BY child_id, child_name
     )
     SELECT
       src.child_id AS source_child_id,
       src.child_name AS source_child_name,
       src.completed_count::int AS source_completed_count,
       tgt.child_id AS target_child_id,
       tgt.child_name AS target_child_name,
       tgt.completed_count::int AS target_completed_count,
       (src.completed_count - tgt.completed_count)::int AS missing_count
     FROM completion_counts src
     CROSS JOIN completion_counts tgt
     WHERE src.child_id != tgt.child_id
       AND src.completed_count > tgt.completed_count
     ORDER BY missing_count DESC`,
    [curriculumId]
  );
  return res.rows;
}
```

**Step 2: Verify no syntax errors**

Run: `cd /home/claude/projects/code/harmony-homeschool && npx tsc --noEmit --pretty 2>&1 | grep curricula`
Expected: No errors from curricula.ts

**Step 3: Commit**

```bash
git add lib/queries/curricula.ts
git commit -m "feat: add getCompletionMismatches query for shared curricula"
```

---

### Task 2: Add `copyCompletionsToChild` server action

**Files:**
- Modify: `lib/actions/completions.ts`

**Step 1: Add the server action**

Append to `lib/actions/completions.ts`:

```typescript
const copyCompletionsSchema = z.object({
  curriculumId: z.string().uuid(),
  sourceChildId: z.string().uuid(),
  targetChildId: z.string().uuid(),
});

export async function copyCompletionsToChild(
  curriculumId: string,
  sourceChildId: string,
  targetChildId: string
) {
  const data = copyCompletionsSchema.safeParse({
    curriculumId,
    sourceChildId,
    targetChildId,
  });
  if (!data.success) {
    return { error: data.error.issues[0]?.message || "Invalid input" };
  }

  const { curriculumId: cId, sourceChildId: sId, targetChildId: tId } = data.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO lesson_completions (lesson_id, child_id, completed_by_user_id, completed_at, grade, pass_fail, notes)
       SELECT lc.lesson_id, $1, lc.completed_by_user_id, lc.completed_at, lc.grade, lc.pass_fail, lc.notes
       FROM lesson_completions lc
       JOIN lessons l ON l.id = lc.lesson_id
       WHERE lc.child_id = $2
         AND l.curriculum_id = $3
       ON CONFLICT (lesson_id, child_id) DO NOTHING`,
      [tId, sId, cId]
    );

    await client.query("COMMIT");

    revalidatePath("/curricula");
    revalidatePath("/lessons");
    revalidatePath("/grades");
    revalidatePath("/dashboard");
    revalidatePath("/students");
    revalidatePath("/reports");
    revalidatePath("/week");
    revalidatePath("/calendar");

    return { success: true, copied: result.rowCount || 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to copy completions", {
      curriculumId: cId,
      sourceChildId: sId,
      targetChildId: tId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to copy completions" };
  } finally {
    client.release();
  }
}
```

**Step 2: Verify no syntax errors**

Run: `cd /home/claude/projects/code/harmony-homeschool && npx tsc --noEmit --pretty 2>&1 | grep completions`
Expected: No errors from completions.ts

**Step 3: Commit**

```bash
git add lib/actions/completions.ts
git commit -m "feat: add copyCompletionsToChild server action"
```

---

### Task 3: Add `CompletionCopyBanner` client component

**Files:**
- Create: `components/curricula/CompletionCopyBanner.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { copyCompletionsToChild } from "@/lib/actions/completions";

interface Mismatch {
  source_child_id: string;
  source_child_name: string;
  source_completed_count: number;
  target_child_id: string;
  target_child_name: string;
  target_completed_count: number;
  missing_count: number;
}

export default function CompletionCopyBanner({
  curriculumId,
  mismatches,
}: {
  curriculumId: string;
  mismatches: Mismatch[];
}) {
  const [copied, setCopied] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (mismatches.length === 0) return null;

  const visibleMismatches = mismatches.filter(
    (m) => !copied[`${m.source_child_id}-${m.target_child_id}`]
  );

  if (visibleMismatches.length === 0) return null;

  async function handleCopy(m: Mismatch) {
    const key = `${m.source_child_id}-${m.target_child_id}`;
    setLoading(key);
    setError(null);

    const result = await copyCompletionsToChild(
      curriculumId,
      m.source_child_id,
      m.target_child_id
    );

    setLoading(null);

    if (result.error) {
      setError(result.error);
    } else {
      setCopied((prev) => ({ ...prev, [key]: result.copied ?? 0 }));
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      {error && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {visibleMismatches.map((m) => {
        const key = `${m.source_child_id}-${m.target_child_id}`;
        const isLoading = loading === key;
        return (
          <div
            key={key}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{m.source_child_name}</strong> has {m.missing_count}{" "}
              completed lesson{m.missing_count !== 1 ? "s" : ""} that{" "}
              <strong>{m.target_child_name}</strong> doesn&apos;t.
            </p>
            <button
              onClick={() => handleCopy(m)}
              disabled={isLoading}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isLoading
                ? "Copying..."
                : `Copy to ${m.target_child_name}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Verify no syntax errors**

Run: `cd /home/claude/projects/code/harmony-homeschool && npx tsc --noEmit --pretty 2>&1 | grep CompletionCopyBanner`
Expected: No errors

**Step 3: Commit**

```bash
git add components/curricula/CompletionCopyBanner.tsx
git commit -m "feat: add CompletionCopyBanner component"
```

---

### Task 4: Wire banner into curriculum detail page

**Files:**
- Modify: `app/curricula/[id]/page.tsx`

**Step 1: Add imports**

At the top of the file, add:

```typescript
import CompletionCopyBanner from "@/components/curricula/CompletionCopyBanner";
import { getCompletionMismatches } from "@/lib/queries/curricula";
```

**Step 2: Fetch mismatch data**

Change the existing `Promise.all` (line 19-22) from:

```typescript
  const [curriculum, assignmentDays] = await Promise.all([
    getCurriculumDetail(params.id),
    getAssignmentDaysForCurriculum(params.id),
  ]);
```

To:

```typescript
  const [curriculum, assignmentDays, mismatches] = await Promise.all([
    getCurriculumDetail(params.id),
    getAssignmentDaysForCurriculum(params.id),
    getCompletionMismatches(params.id),
  ]);
```

**Step 3: Render the banner**

After the `PageHeader` closing tag (after line 60 `</PageHeader>`) and before the subject color dot div (line 61 `<div className="mb-6 flex items-center gap-3">`), add:

```tsx
      <CompletionCopyBanner
        curriculumId={params.id}
        mismatches={mismatches}
      />
```

**Step 4: Verify build**

Run: `cd /home/claude/projects/code/harmony-homeschool && npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No new errors

**Step 5: Commit**

```bash
git add app/curricula/[id]/page.tsx
git commit -m "feat: wire CompletionCopyBanner into curriculum detail page"
```

---

**Total: 4 tasks, ~15 steps, 4 commits.**
