# Codebase Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the harmony-homeschool repo presentable for personal showcase with minimal, targeted changes.

**Architecture:** Three independent cleanup tasks — README polish, code tidiness, repo hygiene. No architectural changes, no new dependencies, no refactoring.

**Tech Stack:** Markdown, Next.js (existing), git

---

### Task 1: Polish README with hero section, features, and screenshot placeholders

**Files:**
- Modify: `README.md`

**Step 1: Add hero section and screenshot placeholders above Docker Quick Start**

Insert after line 3 (`A self-hosted web app for...`) and before `## Docker Quick Start`:

```markdown
![Dashboard](docs/screenshots/dashboard.png)

## Features

- **Student Management** — Track multiple children with individual profiles and progress
- **Lesson Planning** — Organize lessons by subject and curriculum with a kanban-style board
- **Weekly Planner** — Drag-and-drop calendar view with per-child and all-kids views
- **Grade Tracking** — Record and review grades with detailed breakdowns by subject
- **Progress Reports** — Generate reports across subjects, children, and time periods
- **Curriculum Management** — Define curricula, assign to children, and track completion
- **Resource Library** — Attach and manage learning resources across lessons
- **AI-Assisted Import** — Bulk import lessons with LLM support (OpenAI, Claude, or compatible)
- **Self-Hosted** — Full Docker support with PostgreSQL, zero external dependencies
- **Multi-User** — Parent and kid accounts with role-based access

<details>
<summary>More screenshots</summary>

![Weekly Planner](docs/screenshots/weekly-planner.png)
![Lesson Detail](docs/screenshots/lesson-detail.png)
![Grades](docs/screenshots/grades.png)

</details>
```

**Step 2: Create the screenshots directory**

Run: `mkdir -p docs/screenshots`

**Step 3: Add a .gitkeep to the screenshots directory**

Run: `touch docs/screenshots/.gitkeep`

**Step 4: Verify README renders correctly**

Run: `head -40 README.md` — confirm hero section, features, and screenshot placeholders are present and correctly formatted.

**Step 5: Commit**

```bash
git add README.md docs/screenshots/.gitkeep
git commit -m "docs: add features section and screenshot placeholders to README"
```

---

### Task 2: Remove TODO comment and delete empty prompts directory

**Files:**
- Modify: `app/calendar/LessonFormModal.tsx:140-143`
- Delete: `prompts/` directory

**Step 1: Remove the TODO comment block in LessonFormModal.tsx**

In `app/calendar/LessonFormModal.tsx`, replace lines 140-143:

```typescript
    // Save resources via API if this is a new lesson
    // For now, resources are saved on the lesson detail page — the form captures them
    // but actual resource insertion would need a separate server action.
    // TODO: Add resource saving in a follow-up
```

With (remove all 4 comment lines, leaving just the blank line that follows):

```typescript
```

(Delete the 4-line comment block entirely. The blank line between the code above and `setSaving(false)` below can stay.)

**Step 2: Delete the empty prompts directory**

Run: `rm -rf prompts/`

**Step 3: Verify changes**

Run: `grep -n "TODO" app/calendar/LessonFormModal.tsx` — should return nothing.
Run: `ls prompts/ 2>&1` — should say "No such file or directory".

**Step 4: Commit**

```bash
git add app/calendar/LessonFormModal.tsx
git rm -r prompts/ 2>/dev/null || true
git commit -m "chore: remove TODO comment and empty prompts directory"
```

---

### Task 3: Verify repo hygiene (no code changes — verification only)

**Step 1: Confirm .env was never committed**

Run: `git log --all --oneline --diff-filter=A -- .env`

Expected: No output (only `.env.example` was ever committed — already verified).

**Step 2: Confirm internal docs are gitignored**

Run: `git check-ignore AGENTS.md BD.md CLAUDE.md DEPLOYMENT.md ARCHITECTURE_DETAILED.md .cursorrules`

Expected: All 6 files listed back (confirming they are ignored).

**Step 3: Confirm .sisyphus is untracked**

Run: `git status .sisyphus/`

Expected: Nothing listed (not tracked, not staged).

**Step 4: Add .sisyphus to .gitignore**

`.sisyphus/` is currently untracked but NOT in `.gitignore`. Add it for safety:

In `.gitignore`, add after the `.beads/` section:

```
# Sisyphus task runner (local workflow state)
.sisyphus/
```

**Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: add .sisyphus to gitignore"
```

---

**Total: 3 tasks, ~10 steps of actual work, 3 commits.**
