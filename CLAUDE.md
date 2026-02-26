# Harmony Homeschool

A self-hosted homeschool tracking app — Next.js 14 (App Router), TypeScript, Tailwind, PostgreSQL (pg, direct SQL), NextAuth (JWT), Zod.

# ⚠️ STOP AFTER COMPLETING THE TASK ⚠️
Complete the task, update beads, STOP. Do not continue working.

## Feature Specification (MANDATORY)

**`docs/plans/2026-02-26-harmony-homeschool-spec.md`** documents all 12 features: Students, Subjects, Curricula & Lessons, Week Planner, Grades & Reports, Calendar, Resources & Tags, Booklists, External Events, Auth & Users, Admin, Integrations.

**Before any feature work, read the relevant section.** It has current behavior, data models, server actions, pages, key behaviors, and approved future scope. This does NOT count toward the file read limit. Do NOT read the full spec — only the section(s) for your current task.

## Token Efficiency

- ❌ NEVER read files "for context" — use this file and the spec instead
- ❌ NEVER read `db/schema.sql` unless writing a migration
- ❌ NEVER read example files to learn patterns — use this file
- ✅ READ the spec (relevant section only) before feature work — free, no limit
- ✅ ONLY read the 1-2 specific files you are editing beyond that
- ✅ MAXIMUM 2 file reads per task (not counting spec) — ask if you need more

## Task Routing

| Task Type | Read First | Files You'll Touch |
|-----------|-----------|-------------------|
| New/modify feature | Spec section for that feature | Page `app/`, action `lib/actions/`, query `lib/queries/` |
| New page | Key Patterns §1 below | `app/<route>/page.tsx` — must add `force-dynamic` |
| New server action | Key Patterns §2 below | `lib/actions/<domain>.ts` — Zod → query → revalidate |
| UI changes | Component Quick Ref below | `components/<domain>/` — reuse existing components |
| Database changes | Spec data model section | `db/migrations/` — then update queries/actions |
| Bug fix | Spec for expected behavior | Identify root file, fix, verify |

## Beads Workflow

**Every task requires a beads issue.** See `BD.md` for full docs.

```bash
bd ready                                        # Find unblocked work
bd show <id>                                    # Review task details
bd update <id> --status=in_progress             # Claim it
bd close <id> --reason="Done"                   # Complete it
bd create --title="..." --type=task --priority=2  # Create follow-up work
bd sync                                         # Sync with git (session end)
```

**Session flow:** `bd ready` → pick task → `bd show` → claim → read spec section → implement → validate (tsc/lint) → `bd close` → commit → push → `bd sync`

**Well-written issues include:** FILE (exact path), PROBLEM (what's wrong), FIX (exact change), PATTERN (reference to section below).

**Definition of Done:** Bead closed with reason, patterns followed, validation passed, branch clean, no regressions, docs updated.

**After implementing a feature from "Future Scope":**
1. Update `docs/plans/2026-02-26-harmony-homeschool-spec.md` — move the item from "Future Scope" to the feature's current behavior/data model sections
2. Update `CLAUDE.md` if the change affects patterns, components, or conventions (e.g., new reusable component, new DB column agents should know about)

## Key Patterns

### 1. Pages that query database
```typescript
export const dynamic = "force-dynamic";  // REQUIRED — prevents Docker build failures
export default async function Page() {
  const data = await getQuery();
  return <div>...</div>;
}
```

### 2. Server actions (mutations)
```typescript
"use server";
import { z } from "zod";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function doAction(formData: FormData) {
  const data = schema.safeParse({ /* extract */ });
  if (!data.success) return { error: "..." };
  await pool.query("INSERT INTO table (col) VALUES ($1)", [param]);
  revalidatePath("/route");
  return { success: true };
}
```

### 3. Queries
```typescript
import pool from "@/lib/db";
export async function getStuff() {
  const res = await pool.query(`SELECT ... WHERE id = $1`, [id]);
  return res.rows;
}
```

### 4. Client components
Only use `"use client"` for interactivity (useState, onClick). Default is server component.

## Common Pitfalls

- **Missing `force-dynamic`** on DB pages → Docker build fails
- **Forgetting `revalidatePath()`** after mutations → stale UI
- **SQL interpolation** (`${id}`) → SQL injection; always use `$1`, `$2`
- **Unnecessary `"use client"`** → keep as server components unless you need interactivity
- **Missing Zod validation** → always validate before DB operations
- **Wrong action return** → must return `{ success: true }` or `{ error: string }`
- **Next.js 15 syntax in Next.js 14** → `searchParams` is a plain object, NOT a Promise
- **"use server" files** can ONLY export async functions — no re-exports of sync functions or types
- **`lib/permissions.ts` must NOT import `lib/db`** — client components import from it; any `pg` import breaks webpack. Server-only DB functions go in `lib/actions/` instead
- **Never import `lib/db`, `lib/queries/*`, or `lib/actions/*`** from a `"use client"` component — these use `pg` which requires Node.js built-ins (`fs`, `net`, `dns`, `tls`)

## Pre-Push Validation (MANDATORY)

**Before every `git push`, run the Docker build to catch server/client boundary violations:**

```bash
docker compose build app    # MUST pass before pushing
```

`tsc --noEmit` alone does NOT catch `"use server"` export rules or client/server import boundary violations. The Docker build runs `next build` which enforces these. **Do not push if the build fails.**

## Component Quick Reference

**`components/ui/` — reusable, use these before creating new ones:**
- `Modal` — dialog overlay (`isOpen`/`onClose` props)
- `Card` — content container with optional title
- `PageHeader` — page title with optional actions slot
- `Badge` — colored status/category label
- `StatCard` — metric display (label + value + sublabel)
- `ProgressBar` — percentage bar with label
- `EmptyState` — placeholder when no data
- `Sidebar` — app navigation (already in layout)
- `ViewToggle` — switch between view modes (list/board/gallery)
- `EditableCell` — inline-editable table cell
- `RowActions` — dropdown menu for table row actions
- `BulkSelectBar` — floating bar for bulk operations
- `TagInput` — tag autocomplete/create input
- `ResourcePreviewModal` — inline preview for video/PDF resources
- `MarkdownContent` — renders markdown safely

**Domain components** live in `components/<domain>/` (curricula, lessons, week, resources, booklists, dashboard, subjects, grades, prep, tags, reading, approvals, students). Check existing ones before creating new components.

## Data Model

**Core chain:** children → subjects (global) → curricula → curriculum_assignments (child+year) → lessons → lesson_completions

- **Subjects** are global (no child_id), shared across all children
- **Curricula** belong to a subject, assigned to children via `curriculum_assignments`
- **Lessons** belong to a curriculum, inherit child context from assignment
- **Resources** are global (`resources` table), linked to lessons via `lesson_resources`
- **Tags** are global (`tags` table), linked to resources via `resource_tags`, curricula via `curriculum_tags`, and lessons via `lesson_tags`
- **Books** are standalone (`books` table) with status (wishlist/reading/completed)
- **Reading log** tracks pages/minutes per book per child (`reading_log` table)
- **Pending completions** queue for kid-submitted completions awaiting parent approval (`pending_completions` table)
- **Curricula** have `actual_start_date`/`actual_end_date` auto-set on lesson completion
- **Curricula** have `grade_type` (numeric, pass_fail, combo) and `course_type` (curriculum, unit_study)

All PKs are UUID. All FKs indexed. See spec for full per-feature data models.

## Conventions

- **Styling:** Tailwind only, no component libraries, CSS-only charts
- **Imports:** `@/` alias always
- **SQL:** Parameterized (`$1`, `$2`), never interpolate
- **Actions:** Zod validate → query → revalidate → return `{success}` or `{error}`
- **Pages:** `force-dynamic` on all DB-querying pages
- **Theme tokens:** `bg-surface`, `text-primary`, `border-light`, `bg-interactive`, `ring-focus` — no hardcoded colors or manual `dark:` variants. Hover/focus states use same tokens (`hover:bg-interactive`, `focus-visible:ring-focus`).

## Active Constraints

- **Next.js 14** — NOT 15. `searchParams` is a plain object, not a Promise.
- **Auth bypassed** — landing page redirects to `/dashboard` (no login flow)
- **Docker builds without DB** — all DB pages need `force-dynamic`
- **No UI libraries** — Tailwind only (no shadcn, etc.)
- **Direct SQL only** — no ORM
- **pdfkit** dependency for PDF report card generation (`app/api/reports/export/`)

## File Organization

```
app/              # Pages: admin, approvals, booklists, calendar, completed, curricula,
                  #   dashboard, grades, lessons, prep, reading, reports, resources,
                  #   settings, students, subjects, tags, week
app/api/          # Routes: auth (NextAuth), calendar, cron, export, reports, uploads
components/       # By domain: ui/, curricula/, lessons/, dashboard/, resources/, week/, etc.
lib/actions/      # Server actions by domain (incl. reading.ts, weekly-notes.ts, external-events.ts)
lib/queries/      # Read-only queries by domain (incl. reading.ts)
lib/utils/        # Helpers (dates.ts, etc.)
db/               # schema.sql, migrations/, seed.ts
docs/plans/       # Feature spec and planning docs
```

For env vars, dependencies, and commands, see `REFERENCE.md`.
