# Harmony Homeschool — Improvement Batches (Implementation Instructions)

> **Source:** A six-pass review of this repo (backend security, database/data-integrity, ops/stability, code quality, a completeness sweep of every API route + MCP server + uploads + secrets, and a frontend/performance/accessibility pass), plus a live-app tour of https://harmony.pwny.club, `npm audit`, and a full test run (30/30 passing).
>
> **Date:** 2026-07-22

---

## How to use this document

- Work batch by batch, **in order**. **Batch 1 is urgent** — the SSRF (1.6) and open signup (1.3) are exploitable by anonymous users on the public URL today.
- Create one beads issue per numbered task (`bd create`), claim it, implement, validate, close, commit — per the CLAUDE.md session flow. **One commit per task.**
- Reading this document and any file it names does **not** count against CLAUDE.md's file-read limit.
- **Line numbers are approximate anchors** from the review. Locate code by symbol name; the line may have drifted.
- Validation gates before every push: `npx tsc --noEmit`, `npm test`, `npm run lint`, `docker compose build app`.

### Do not break what's already good

The review confirmed these are correct — preserve them:

- **Parameterized SQL everywhere** — zero injection found across the entire codebase.
- **`app/api/webhooks/vikunja/route.ts`** — HMAC-SHA256 with `timingSafeEqual`, fails **closed** when the secret is unset. **This is the reference pattern** for tasks 1.8 and anything else needing secret comparison.
- **`app/api/cron/bump-lessons/route.ts`** — timing-safe secret compare, rejects when `CRON_SECRET` is unset. The code is right; only the deployment wiring is missing (2.5).
- Upload filename generation (`Date.now()-randomUUID()`) and the existing traversal rejection in the uploads route.
- Native `<dialog>` in `components/ui/Modal.tsx` (free focus trap + Esc).
- Optimistic drag-and-drop with rollback in `components/week/WeekGrid.tsx`.
- Batched read queries using the `ANY($1)` pattern (e.g. `lib/queries/week.ts:163-179`) — no N+1 in any read path.
- Existing index coverage and UNIQUE constraints in `db/schema.sql` — both were audited and found solid.

### New / changed environment variables

| Var | Batch | Meaning |
|---|---|---|
| `SIGNUP_ENABLED` | 1 | `true` enables `/signup`; default off (bootstrap exception: allowed when zero users exist) |
| `SIGNUP_INVITE_CODE` | 1 | optional invite code required by signup when set |
| `CALENDAR_ICAL_TOKEN` | 1 | required secret for the iCal feed; feed 403s when unset |
| `SEED_DEMO` | 1 | seed script only creates the default parent account when `true` |
| `CRON_SECRET` | 2 | existing var, finally wired into compose + cron sidecar |
| `APP_TIMEZONE` | 2 | IANA TZ for all school-date math (default `America/New_York`) |
| `HA_WEBHOOK_URL` | 3 | optional Home Assistant webhook for the daily digest |

---

# Batch 1 — Lock the doors (security) 🔴

## 1.1 Central authorization guards for all server actions (root-cause fix)

**FILE:** new `lib/server/authz.ts`; then every file in `lib/actions/` (18 files, ~119 exported actions).

**PROBLEM:** `middleware.ts` only gates page *paths*. Next.js server actions bypass middleware entirely, and almost no action checks its caller. Confirmed exploits:

- `createKidAccount`, `resetKidPassword`, `updateKidPermission`, `deleteKidAccount` (`lib/actions/auth.ts`) — callable by **any** session, including a kid's.
- `bulkCreateLessonCards` (`lib/actions/lesson-cards.ts` ~:296) and `bulkCreateLessonResources` (`lib/actions/resources.ts` ~:665) — callable with **no session at all**, and they are the SSRF vector (see 1.6).
- Kids can edit grades and approve their own pending completions.

**FIX:**

1. Create `lib/server/authz.ts` with two helpers built on `getServerSession(authOptions)`:
   - `requireUser()` → returns `{ id, role, childId, permissionLevel }`, or `null` when there is no session or no `user.id`. Callers return `{ error: "Unauthorized" }` on null (matches the established action return convention).
   - `requireParent()` → `requireUser()` **and** `role === "parent"`, else `null`.
2. Add a guard as the **first statement of every exported action** in `lib/actions/*.ts`. **Default policy: `requireParent()`.**
3. **Exceptions (kid-callable actions).** Read the spec's *Auth & Users* and *Grades & Reports* (approvals) sections to confirm the full list. At minimum: the pending-completion submit path in `lib/actions/completions.ts` and the kid reading-log actions in `lib/actions/reading.ts`. These use `requireUser()`, and when the caller is a kid they must:
   - **Force child scope to the session's own `child_id`** via `resolveChildScopeForRequest` (`lib/auth-scope.ts:9`) — ignore any caller-supplied `childId` entirely.
   - Respect `permission_level`: `view_only` kids may not mutate at all; `mark_complete` kids may only submit/mark completions.
4. **Approval and rejection of pending completions is parent-only** — a kid must never be able to approve their own submission.

**ACCEPT:** Every exported action in `lib/actions/` begins with a guard. A kid session invoking a parent-only action gets `{ error }` and performs no DB write. An anonymous invocation gets `{ error }`. Existing parent flows still work. Add tests to `tests/auth-scope.test.ts` covering: anonymous → rejected; kid → rejected on a parent-only action; kid completion forced to own `child_id` even when another is supplied.

---

## 1.2 Fail-closed sessions

**FILE:** `lib/auth.ts` (~:59, :72, :74); `lib/session.ts` (~:15, :19).

**PROBLEM:** Missing token/session fields default to `role: "parent"` and `permission_level: "full"` — the system fails **open** to the most privileged identity.

**FIX:** In both files, when `role` is absent, treat the session as invalid (the 1.1 authz helpers return `null` → unauthorized); never default role to `"parent"`. Default `permission_level` to `"view_only"`, not `"full"`. Keep `getCurrentUser()`'s call sites working, but have it return a discriminated "unauthenticated" result rather than fabricating a parent.

**ACCEPT:** A JWT missing `role` cannot invoke any guarded action or reach parent pages.

---

## 1.3 Gate signup

**FILE:** `lib/actions/auth.ts` (`signupUser` — inserts `role='parent'` at ~:32); `app/signup/`; the login page's signup link.

**PROBLEM:** `/signup` is public and mints full parent accounts. **Confirmed live** on the production URL — a stranger who finds it owns the family's data.

**FIX:** `signupUser` refuses unless `SIGNUP_ENABLED === "true"` **or** the `users` table is empty (first-run bootstrap). When `SIGNUP_INVITE_CODE` is set, require a matching invite-code field, compared with `crypto.timingSafeEqual`. The signup page renders a "signup is disabled" state, and the login page hides the signup link when disabled.

**ACCEPT:** An anonymous POST to signup with the feature disabled creates no row. A fresh, empty DB still allows creating the first parent account.

---

## 1.4 Login rate limiting

**FILE:** `lib/auth.ts` → `authorize()` (~:24-46).

**PROBLEM:** Unlimited bcrypt-checked password guesses. Pairs badly with the well-known seeded account (1.10).

**FIX:** In-memory limiter keyed by lowercased email: after 5 failed attempts, lock that key for 15 minutes; clear the counter on success. A `Map` of `{ count, lockedUntil }` is fine — this is a single-instance app; **add a comment noting the limitation if it is ever horizontally scaled.** Reject locked keys *before* running the bcrypt compare.

**ACCEPT:** The 6th consecutive bad password for an email is rejected without a bcrypt compare; the correct password works again after the window expires.

---

## 1.5 Patch Next.js + dependency audit

**FILE:** `package.json`.

**PROBLEM:** `next@14.2.21` is deprecated with known security vulnerabilities, including the **middleware-bypass CVE class** (patched in 14.2.25+). That is critical here specifically because middleware is currently the only page guard. `npm audit` reports 22 findings total (1 critical, 13 high); most of the rest are dev-chain.

**FIX:** `npm install next@^14.2` to pick up the **latest 14.2.x patch**. **Do NOT jump to Next 15 or 16** — CLAUDE.md pins Next 14 semantics (`searchParams` is a plain object, not a Promise). Then run `npm audit fix` **without `--force`**, which skips the semver-major `eslint-config-next` suggestion. Re-run build and tests.

**ACCEPT:** `npm audit` reports no critical findings; `next` is ≥ 14.2.35; `docker compose build app` passes.

---

## 1.6 Kill the SSRF in Trello download

**FILE:** `lib/server/trello-download.ts` (~:28-50); callers in `lib/actions/lesson-cards.ts` and `lib/actions/resources.ts`.

**PROBLEM:** A caller-supplied URL is fetched server-side with `redirect: "follow"` and the response body is written into the publicly served uploads directory. The only current handling is a string swap of `trello.com` → `api.trello.com`; anything else is fetched verbatim. Combined with the missing auth in 1.1, this is **anonymous SSRF with response readback** — a stranger can make the server probe the internal network (or cloud metadata endpoints) and then read the result over the public uploads route.

**FIX:** Parse the URL. Require protocol `https:` and a hostname exactly matching an allowlist — `["trello.com", "api.trello.com"]`, plus a `trellocdn.com` suffix check **if** attachments actually resolve there (verify against a real card before adding it). Use `redirect: "manual"` and only follow redirects whose target passes the same allowlist check. Reject anything else with `{ error }` and perform no fetch. Keep the 50 MB cap. Task 1.1 also adds `requireParent()` to both calling actions — **keep both defenses**, they protect against different failures.

**ACCEPT:** The action called with `http://169.254.169.254/` (or any non-Trello host) returns an error and performs **no** outbound fetch. A genuine Trello attachment still downloads successfully.

---

## 1.7 Fix report / booklist export IDOR

**FILE:** `app/api/reports/export/route.ts` (~:9-17), `app/api/reports/year-summary/route.ts` (~:9-21), `app/api/export/booklist/route.ts` (~:9-11).

**PROBLEM:** The two report routes check only that *a* session exists, then trust the `childId` query param — **any kid can export any child's PDF grade report.** The booklist export is missing the kid-role rejection that its sibling routes (`app/api/export/route.ts:8-10`, `app/api/export/curriculum/route.ts:8-10`) already have.

**FIX:** In both report routes, resolve `childId` through `resolveParentChildScopeForRequest` (`lib/auth-scope.ts:28`) and return 403 on `error` — mirroring how `app/api/calendar/route.ts` already does it. In the booklist export, add the same `role === "kid"` rejection its siblings use.

**ACCEPT:** A kid session requesting another child's report gets 403. A parent requesting a child they don't own gets 403. Own-child export still works.

---

## 1.8 iCal feed: fail closed + fix DTSTART

**FILE:** the iCal route under `app/api/calendar/`.

**PROBLEM:** **Confirmed live:** with no token configured the feed serves all 323 lesson events — including the kids' names — to any anonymous requester. It fails **open**. The Vikunja webhook right next door fails **closed**; copy that pattern. Separately, `DTSTART` emits a raw JavaScript date string, which breaks some calendar clients.

**FIX:** Require `CALENDAR_ICAL_TOKEN`: return 403 when the env var is unset **or** when the `?token=` query param doesn't match (timing-safe compare). Emit all-day dates as `DTSTART;VALUE=DATE:YYYYMMDD` with a matching `DTEND`. Update the README and any in-app settings text with the new URL shape.

**ACCEPT:** An unauthenticated fetch returns 403. A tokened fetch validates in an iCal linter and imports cleanly into Google Calendar.

---

## 1.9 Harden the public uploads route

**FILE:** `app/api/uploads/[...path]/route.ts`.

**PROBLEM:** Serves any uploads file to anonymous users. `.svg` is served inline as `image/svg+xml` with a year-long `immutable` cache → a stored-XSS vector, reachable via 1.6's arbitrary-content write until that is fixed. (`saveUploadedImage` correctly rejects SVG; `downloadTrelloFile` does not.) Traversal is already blocked and filenames are unguessable — **keep both**.

**FIX:** Serve `.svg` and any non-allowlisted extension with `Content-Disposition: attachment` plus `Content-Security-Policy: sandbox`. Add `X-Content-Type-Options: nosniff` to all responses. Keep images and PDFs inline so existing lesson content still renders.

**ACCEPT:** Fetching an uploaded SVG downloads it instead of executing it. Existing lesson images still render in the app.

---

## 1.10 Stop seeding default credentials

**FILE:** `db/seed.ts` (currently creates `parent@harmony.local` / `harmony123`).

**FIX:** Only create the demo parent when `SEED_DEMO === "true"`. Otherwise seed reference data only and print a pointer to the signup bootstrap path from 1.3. Update the README.

**MANUAL STEP FOR THE USER:** the **live instance already has** `parent@harmony.local` with the default password. Rotate that password (or delete the account) after Batch 1 deploys — code changes alone do not fix the existing row.

**ACCEPT:** A default `npm run db:seed` creates no login account.

---

## 1.11 Guard NEXTAUTH_SECRET in the base compose file

**FILE:** `docker-compose.yml` (~:25); `.env.example`.

**PROBLEM:** The base file uses `NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}` with no guard, while `docker-compose.app.yml:51` and `docker-compose.full.yml:94` correctly use `${NEXTAUTH_SECRET:?...}`. An empty secret makes NextAuth JWT signing insecure and unstable.

**FIX:** `NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?Set NEXTAUTH_SECRET}`. Also replace `.env.example`'s `your-secret-here` placeholder with an obvious `CHANGE-ME-run-openssl-rand-base64-32` string plus a generation comment.

**ACCEPT:** `docker compose up` without the variable set fails fast with the message.

---

## 1.12 Quick wins riding along

**Tailwind double-modifier typos.** Classes with two opacity modifiers are invalid and silently dropped by Tailwind, producing no CSS:

- `components/week/WeekGrid.tsx:353` — `dark:border-amber-800/60/20`
- `components/week/WeekGrid.tsx:469` — today's-cell background (**this is why "today" never highlights on the week grid**)
- `components/week/WeekGrid.tsx:504` — `py-1/70`
- `components/booklists/BooklistsClient.tsx:422` — two instances

Fix: one modifier per class (e.g. `bg-interactive-light/30`). **Do not** fix `components/week/DayColumn.tsx` — it is deleted in 3.7.

**PWA manifest.** Add `app/manifest.ts` with name, `short_name: "Harmony"`, theme/background colors drawn from the existing token palette, and 192/512 icons generated from the app logo — so the kids' tablets can install it as an app. Verify installability in Chrome DevTools → Application → Manifest.

---

# Batch 2 — Protect the data 🟠

## 2.1 Fix fresh-install schema ordering

**FILE:** `db/schema.sql` — `lesson_cards.resource_id REFERENCES resources(id)` at ~:139 precedes `CREATE TABLE resources` at ~:148. **Verified.**

**PROBLEM:** A brand-new deploy crash-loops; the schema cannot be applied to an empty database. This matters the moment anyone else self-hosts.

**FIX:** Move the `resources` (and `resource_tags`, if dependent) CREATE above `lesson_cards`, **or** drop the inline FK and add `ALTER TABLE lesson_cards ADD CONSTRAINT ... FOREIGN KEY ...` after all CREATEs. Keep the file idempotent if it currently is.

**ACCEPT:** `psql -f db/schema.sql` into an **empty** database succeeds. `docker compose up` with a fresh volume boots to the login page.

---

## 2.2 Fix the deleteKidAccount FK crash

**FILE:** new migration in `db/migrations/`; `db/schema.sql`; `lib/actions/auth.ts` (`deleteKidAccount`).

**PROBLEM:** `lesson_completions.completed_by_user_id UUID NOT NULL REFERENCES users(id)` (schema ~:188) has **no ON DELETE** clause. Deleting any kid who has ever completed a lesson throws a foreign-key violation — the delete feature is broken for every real account.

**FIX:** Migration: drop `NOT NULL`, add `ON DELETE SET NULL`. Mirror the change in `db/schema.sql`. Ensure any UI showing "completed by" renders a null gracefully.

**ACCEPT:** Deleting a kid who has completions succeeds; the completions remain attached to the child record. Test added.

---

## 2.3 Automated backups

**FILE:** compose file(s) — **do 2.5 first or together**; new `scripts/backup.sh`; README section.

**PROBLEM:** There is no backup story at all for the Postgres volume. That volume holds the family's entire school record.

**FIX:** Add a `backup` sidecar service (`postgres:16-alpine`, or matching the DB's major version) running a loop: nightly `pg_dump -Fc` into a bind-mounted `./backups` directory, retaining the last 14, logging each run. Document the one-line restore (`pg_restore -d ...`). Recommend the user syncs `./backups` off-box — their Nextcloud is a natural target; **mention it in the README, don't implement it.**

**ACCEPT:** After `docker compose up`, a dump file appears on schedule (test with a shortened interval). The documented restore works into a scratch database.

---

## 2.4 Pool error handler

**FILE:** `lib/db.ts`.

**PROBLEM:** No `pool.on("error")` handler. An idle-client error — a DB restart, a network blip — crashes the entire Node process.

**FIX:** Attach `pool.on("error", (err) => console.error("pg pool idle client error", err))`. **Do not exit** the process.

**ACCEPT:** Restarting the postgres container while the app is idle no longer kills the app container.

---

## 2.5 One canonical compose file + wire the cron

**FILE:** `docker-compose.yml`, `docker-compose.app.yml`, `docker-compose.full.yml`, README.

**PROBLEM:** Three divergent compose files each enable a different subset of features. `CRON_SECRET` appears in **none** of them, so scheduled lesson-bumping has never run under Docker — masked today by the on-page-load fallback that Batch 3 removes. **Sequencing: this task must land before 3.1.**

**FIX:** Collapse to a single `docker-compose.yml` (app + db + backup + cron sidecar), with a documented optional override file for whatever extras are currently unique to `full`. Cron sidecar: a `curlimages/curl` loop or supercronic, hitting `http://app:3000/api/cron/bump-lessons` daily at ~05:00 `APP_TIMEZONE` with `Authorization: Bearer ${CRON_SECRET:?}`. Delete the superseded compose files.

**ACCEPT:** A single `docker compose up -d` yields app + db + backup + cron. The cron container log shows a 200 from the bump route.

---

## 2.6 CI gates the image

**FILE:** the existing publish workflow under `.github/workflows/`.

**PROBLEM:** CI builds and pushes the `:latest` Docker tag with no tests, lint, or typecheck — the test suite exists (30 passing) but never runs in CI.

**FIX:** Add a job running `npm ci`, `npx tsc --noEmit`, `npm test`, `npm run lint`. Make the docker build/push job depend on it via `needs:`. Also tag images with the git SHA alongside `:latest`.

**ACCEPT:** A PR with a failing test cannot publish. Published images carry SHA tags.

---

## 2.7 One timezone for school-date math

**FILE:** `lib/utils/dates.ts` (local-time based), `lib/utils/school-dates.ts` (UTC based), `app/api/cron/bump-lessons/route.ts` (~:5-11, computes "today" in UTC).

**PROBLEM:** Two date modules disagree: `dates.ts` uses local time (`getDay`, `getFullYear`, local-midnight construction, `isToday`), while `school-dates.ts` uses UTC (`parseDateKey` → `T00:00:00.000Z`, `getUTCDay`, `formatDateKey`). On a server not running in UTC, school-day checks, "today" highlighting, and the nightly bump can land on the **wrong calendar day**.

**FIX:** Introduce `APP_TIMEZONE` (default `America/New_York`). Add a single `todayKey()` helper that computes the current date-key in that zone via `Intl.DateTimeFormat` parts, and route **all** "what day is it right now" decisions through it — the cron route, `isToday`, and week-start computation. **Keep `school-dates.ts`'s pure key math as-is** — it is date-key-in / date-key-out and already tested; the bug is only where "now" enters the system.

**ACCEPT:** Existing date tests still pass. New test: with `APP_TIMEZONE=America/New_York` and a clock mocked to 03:00 UTC, `todayKey()` returns the *previous* calendar date, and the cron bumps based on that key.

---

## 2.8 Truth-up the agent docs

**FILE:** `CLAUDE.md`, the architecture docs under `docs/`, the spec.

**PROBLEM:** CLAUDE.md's Active Constraints claims *"Auth bypassed — landing page redirects to /dashboard (no login flow)"* — that is false; the app has a full NextAuth login. The review also found ARCHITECTURE.md describing a different application than what is built. Stale agent docs actively cause bad changes.

**FIX:** Correct the Active Constraints section (auth is NextAuth JWT + middleware + the new action guards). Document `lib/server/authz.ts` as the **mandatory** pattern for new actions — add it to Key Patterns §2. List the new environment variables. Remove or rewrite stale architecture claims.

**ACCEPT:** A fresh agent following CLAUDE.md alone would write a properly guarded server action.

---

# Batch 3 — Live with it daily 🟡

## 3.1 Move overdue-bumping off page load (biggest daily speedup)

**FILE:** `app/dashboard/page.tsx` (~:46-50), `app/week/[weekStart]/page.tsx` (~:38-44), `lib/actions/lessons.ts` (`bumpOverdueLessons`, ~:194-305).

**PROBLEM:** `bumpOverdueLessons` runs **per child on every load of the two hottest pages.** It issues one query for assignments, then per assignment a full fetch of every non-completed lesson plus a date-overrides query — easily 20-50 queries per page view for a multi-kid family, almost always finding nothing to bump. It is also a **write-on-GET** (two open tabs can race), and every completion-checkbox tick calls `router.refresh()`, re-running the whole thing.

**FIX:** Remove both page-load call sites — the cron from 2.5 owns bumping now. Inside `bumpOverdueLessons`, first run one cheap `EXISTS` query (`planned_date < today AND status != 'completed'`, scoped to the assignment set) and return early when nothing qualifies. As a belt-and-suspenders fallback for non-Docker deploys, keep an opt-in lazy path gated by a `last_bumped_at` value (single-row settings table) that short-circuits unless the stored day differs from today.

**ACCEPT:** Dashboard and week page loads issue **no** bump writes; the cron still bumps. Measure the week-page query count before and after, and record both numbers in the bead close reason.

---

## 3.2 Fix tablet touch-drag on the week planner

**FILE:** `components/week/WeekGrid.tsx` (~:313-330 touch handlers, ~:616 lesson button classes).

**PROBLEM:** `event.preventDefault()` is called inside React's `onTouchMove`, but React attaches `touchmove` as a **passive** root listener, so the call is ignored (with a console warning) and the page scrolls underneath the drag. There is no `touch-action` CSS on the lesson buttons either. Drag on the kids' tablets is broken.

**FIX:** While a touch-drag is active, attach a document-level `touchmove` listener with `{ passive: false }` via `useEffect`/ref and call `preventDefault()` there; and/or set `touch-action: none` on the dragged element during the drag. Clean up on drag end.

**ACCEPT:** On a real tablet (or DevTools touch emulation), dragging a lesson moves the card without scrolling the page. Normal scrolling is unaffected when not dragging.

---

## 3.3 Make lesson-reassign reachable on touch

**FILE:** `components/week/WeekGrid.tsx` (~:631), `components/lessons/LessonDetailModal.tsx`.

**PROBLEM:** The reassign control is `hidden group-hover/lesson:block` — mouse-only. It is **literally unreachable** on every phone and tablet, which is the stated primary audience.

**FIX:** Also reveal on `group-focus-within/lesson:block`, and add the reassign (move-to-day / move-to-child) affordance inside `LessonDetailModal`, which touch users reach by tapping the lesson.

**ACCEPT:** A tablet user can reassign a lesson end-to-end without hover.

---

## 3.4 Keyboard & screen-reader fixes

**FILE:** `components/week/WeekGrid.tsx` (day cells ~:448-469; weekly-note `<p onClick>` ~:427-429; filter selects ~:361-371), `components/subjects/SubjectsView.tsx` (~:171-174), `components/lessons/EditableLessonsTable.tsx` (filter inputs ~:780-792).

**FIX:** Clickable `<div>`s and `<p>`s get `role="button"`, `tabIndex={0}`, and Enter/Space handlers — or become real `<button>`s. The subject-card navigation wraps in a real link/button instead of `<div onClick={router.push(...)}>`. Unlabeled filter `<select>`s and inputs get `aria-label`s ("Filter by subject", "Filter by course", etc.).

**ACCEPT:** Tabbing through the week page reaches the day cells and the weekly note. An axe / DevTools accessibility scan shows no unlabeled form controls on the week and lessons pages.

---

## 3.5 Mobile-friendly week board

**FILE:** `components/week/WeekGrid.tsx` (layout); possibly a small extracted component.

**PROBLEM:** The multi-column grid is effectively desktop-only, and parent-on-phone is a primary use case.

**FIX:** Below the `md` breakpoint, render days as horizontally snap-scrolling columns (`overflow-x-auto snap-x`, one day ≈85vw) **or** as stacked day sections with today auto-scrolled into view — pick whichever fits the existing markup with less surgery. Keep the desktop grid untouched at `md+`. Theme tokens only, per CLAUDE.md conventions.

**ACCEPT:** At 375px width, every day's lessons are reachable and completable, with no horizontal body scroll. Desktop layout is unchanged.

---

## 3.6 Loading skeletons

**FILE:** new `loading.tsx` files for `app/dashboard`, `app/week/[weekStart]`, `app/lessons/table`, `app/curricula`, `app/grades`.

**FIX:** Simple pulse skeletons matching each page's card/table silhouette, using existing tokens (`bg-interactive`, `animate-pulse`). No spinners.

**ACCEPT:** A hard refresh on a throttled connection shows content silhouettes instead of a blank screen.

---

## 3.7 Delete dead code, merge the forked modal

**FILE:**
- Delete `app/calendar/LessonDetailModal.tsx` — a 219-line, **byte-identical**, unimported duplicate of `components/lessons/LessonDetailModal.tsx` (CalendarView already imports the `components/` copy).
- Delete `components/week/DayColumn.tsx` — unused.
- Merge `app/calendar/LessonFormModal.tsx` (397-line **diverged fork**) into `components/lessons/LessonFormModal.tsx` (572 lines): diff the two, port any calendar-only behavior behind props, update the calendar import, delete the fork. Right now edits to one never reach the other.

**ACCEPT:** `grep -r "calendar/LessonFormModal\|calendar/LessonDetailModal\|week/DayColumn"` finds nothing. Calendar create/edit lesson flows still work. Build passes.

---

## 3.8 Dedupe page queries

**FILE:** `app/dashboard/page.tsx` (`getAllChildren` called at both ~:46 and ~:55; external-events fetch awaited separately at ~:79 despite having no dependency on the `Promise.all` at ~:52), `app/week/[weekStart]/page.tsx` (`getWeeklyNotes` awaited after the batch at ~:73).

**FIX:** One `getAllChildren` call, reused. Fold the independent fetches into the existing `Promise.all`.

**ACCEPT:** Each page issues each query once. Visual output unchanged.

---

## 3.9 Global search

**FILE:** new `lib/queries/search.ts`; new `app/api/search/route.ts` (session-guarded, kid-scoped via `resolveChildScopeForRequest`); new `components/ui/SearchCommand.tsx`; mounted in the layout header / Sidebar.

**FIX:** One UNION query across lessons (title), curricula (name), resources (title), and books (title) — `ILIKE` on a shared `q` param, ~10 results per type, each row returning type + id + the route to link to. Client: a debounced (250ms) combobox opened by a header button and `Cmd/Ctrl-K`, arrow-key navigable, built from the existing Modal and theme tokens.

**ACCEPT:** Searching a known lesson title from any page navigates to it. Kid sessions see only their own scope. Anonymous requests get 401.

---

## 3.10 "Sick week" bulk shift

**FILE:** new action in `lib/actions/schedule.ts`; UI entry on the week page (parent only).

**FIX:** Action `shiftLessons({ childId | all, fromDate, days })` pushes every non-completed lesson with `planned_date >= fromDate` forward by N **school days** — reuse `nextValidSchoolDate` from `lib/utils/school-dates.ts`, which is already tested. One transaction, `requireParent()` guarded, Zod validated. UI: a small modal from the week header ("Shift this week forward…") with child selector, start date, and day count, plus a confirmation showing how many lessons will move.

**ACCEPT:** Shifting a sick week moves incomplete lessons only and lands them on valid school days. Running the inverse shift restores them — **document that reversing means re-running with an inverse plan, not a stored undo.**

---

## 3.11 Daily digest via Home Assistant

**FILE:** new `app/api/cron/daily-digest/route.ts` (same auth pattern as `bump-lessons`); a cron sidecar entry (from 2.5); README.

**FIX:** When `HA_WEBHOOK_URL` is set, the route composes per-child "due today / overdue" counts plus top items and POSTs JSON to the webhook; cron hits it each school-day morning at ~07:00 `APP_TIMEZONE`. Keep the payload **generic JSON** — the user wires the Home Assistant automation to `notify.mobile_app_applejack` themselves. Include a sample HA automation YAML in the README section.

**ACCEPT:** `curl` with the cron secret produces a well-formed payload against a request bin. With `HA_WEBHOOK_URL` unset, the route no-ops with 200 "disabled".

---

# Batch 4 — Grow into it

## 4.1 Attendance & instructional-hours tracking

**FILE:** new migration (`attendance_days`: `child_id`, `date`, `status` present/absent/holiday, minutes override, `UNIQUE(child_id, date)`); queries; an addition to `app/reports`.

**FIX:** Auto-derive a "present" day for any date a child has ≥1 lesson completion (derive at query time, no writes), with manual override rows for absences and extra days. Report view plus CSV export: days attended and instructional hours per child per school year (hours = sum of lesson durations if the schema has one, otherwise a per-day default the parent sets). Parent-only. **This is the feature that makes state homeschool reporting painless.**

**ACCEPT:** The report matches a hand-count for one child-month. The export opens cleanly in Excel.

---

## 4.2 Transcript generation

**FILE:** new `app/api/reports/transcript/route.ts`, reusing the pdfkit patterns from `app/api/reports/export/route.ts` (**including its 1.7 ownership check**); UI entry on the reports page.

**FIX:** Per child and year-range: course list from curricula/assignments, final grades from the grades tables per `grade_type`, a credits column (add a nullable `credits NUMERIC` to curricula via migration; blank until set), and GPA when numeric grades exist. Clean single-page PDF layout.

**ACCEPT:** A generated transcript for a child with 2+ graded curricula renders correctly and respects ownership checks.

---

## 4.3 Per-child lesson status (spec Future Scope)

**FILE:** **Read the spec's *Curricula & Lessons* section first** — this item is already specced. Follow the spec's data-model direction (status per assignment/child rather than global on the lesson).

**FIX & ACCEPT:** Per spec. After implementing, move the item out of Future Scope per the CLAUDE.md post-feature checklist.

---

## 4.4 Approval audit trail

**FILE:** new migration (`audit_log`: `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `detail JSONB`, `created_at`); writes from the approval/rejection actions in `lib/actions/completions.ts` and the admin account actions in `lib/actions/auth.ts`; a read-only view under `app/admin`.

**FIX:** Append-only inserts **inside the same transaction** as the audited mutation. Admin page lists newest-first with filters by actor and entity. Parent-only.

**ACCEPT:** Approving a pending completion produces a row. The admin view shows who approved what, and when.

---

## 4.5 Lessons-table pagination

**FILE:** `app/lessons/table/page.tsx` (~:14-18), `lib/queries/lessons.ts` (`getAllLessonsWithResources` ~:140-176), `components/lessons/EditableLessonsTable.tsx`.

**PROBLEM:** Loads every lesson plus every resource with no LIMIT, serializes it all into the RSC payload, and renders every filtered row with editable cells — no pagination or virtualization anywhere in the component's 1166 lines. Fine today; it will crawl on tablets as the school year fills.

**FIX:** Server-side pagination (page + filters in `searchParams`, LIMIT/OFFSET plus a total count) — preferred over virtualization because the table is editable. Keep the current client filters working by pushing them into the query.

**ACCEPT:** 100-row pages load fast with 1000+ lessons seeded. Edits still save.

---

## 4.6 Planner drag-and-drop polish (spec Future Scope)

**FILE:** the spec's *Week Planner* / *Calendar* sections; `components/week/WeekGrid.tsx`; calendar components. The `@dnd-kit` dependencies are already installed.

**FIX:** Per spec — calendar drag-and-drop rescheduling, building on the touch support fixed in 3.2. Keep the existing optimistic-update + rollback pattern.

**ACCEPT:** Per spec. Future Scope updated.

---

# Verification (run at the end of each batch)

1. `npx tsc --noEmit && npm test && npm run lint`
2. `docker compose build app` — **mandatory before every push** per CLAUDE.md; `tsc` alone does not catch `"use server"` export rules or client/server boundary violations.
3. **Batch 1 extra:** from an incognito browser against a local run — signup blocked, iCal returns 403 without a token, a kid login cannot reach admin actions or another child's report exports; `npm audit` clean of criticals.
4. **Batch 2 extra:** fresh-volume `docker compose up` reaches the login page; kill and restart the db container and confirm the app survives; a backup file appears.
5. **Batch 3 extra:** week page usable at 375px; drag works under touch emulation; Lighthouse accessibility pass on the week page.
6. `bd sync` at session end.

---

# Appendix — Areas the review confirmed CLEAN

Recorded so future work doesn't re-audit them:

- **MCP server** (`mcp/homeschool-server.ts`) — stdio transport only, no network listener, reads a local JSON file, not wired into `package.json` scripts. No attack surface. (It is dead/parallel code unrelated to the Postgres data model — consider deleting it separately.)
- **Webhook auth** (`app/api/webhooks/vikunja/route.ts`) — HMAC-SHA256, `timingSafeEqual`, fails closed. Reference pattern.
- **Cron auth** (`app/api/cron/bump-lessons/route.ts`) — timing-safe compare, rejects when the secret is unset. Code correct; only deployment wiring was missing (2.5).
- **Path traversal on upload serve** — rejects `..` and `/` in segments before `path.join`. Filenames are `Date.now()-randomUUID()`, so enumeration is impractical.
- **Trello read route** (`app/api/trello/route.ts`) — session-gated, read-only.
- **Committed secrets** — none. Only `.env.example` is tracked; `.gitignore` covers `.env`, `.env.local`, `.claude/`. No secrets in `next.config.js`, `vercel.json`, or compose files.
- **UNIQUE constraints** — good coverage across `users.email` and all natural keys; no duplicate-allowing gaps found.
- **FK ON DELETE behavior** — deliberate and correct everywhere except `lesson_completions.completed_by_user_id` (fixed in 2.2).
- **Read-path query batching** — no N+1 in any read path; resource fetches use `ANY($1)` batching.
- **Client bundle** — `pdfkit` is server-only; no heavy dependencies leak client-side; `lucide-react` is tree-shakeable.
- **Server/client split** — only `login` and `signup` pages are client components; queries live in `lib/queries`.
- **Accessibility positives** — close buttons carry `aria-label`s, images consistently have `alt`, `LessonCompleteCheckbox` is a real labeled checkbox, `Modal` uses native `<dialog>`.
