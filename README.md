# Harmony Homeschool

A self-hosted web app for planning homeschool lessons, tracking completion, and reviewing progress.

## Features

- **Student Management** — Track multiple children with individual profiles and progress
- **Lesson Planning** — Organize lessons by subject and curriculum with a kanban-style board
- **Weekly Planner** — Drag-and-drop week board with per-child and all-kids views
- **Calendar** — Month and semester views; drag a lesson to another day to reschedule it, and the rest of the course follows onto valid school days
- **School Calendar** — School years, school days, holidays and make-up days drive every scheduling decision, including the nightly bump of overdue work
- **Grade Tracking** — Record and review grades with weighted averages and configurable letter-grade scales
- **Progress Reports** — Reports across subjects, children, and time periods, plus attendance/instructional hours and credit-weighted transcripts (CSV and PDF export)
- **Curriculum Management** — Define curricula, assign to children, and track completion per child — two children can share a course and progress through it independently
- **Resource Library** — Attach and manage learning resources across lessons, with tags and booklists
- **Reading Log** — Kids log their own reading; streaks and weekly totals show on the dashboard
- **Approvals** — Kids mark work complete and it queues for a parent to approve; approvals and account changes are recorded in an audit log
- **Calendar Subscriptions** — Token-protected iCal feed per child, plus an optional daily "what's due" digest webhook
- **AI-Assisted Import** — Bulk import lessons with LLM support (OpenAI, Claude, or compatible)
- **Self-Hosted** — Full Docker support with PostgreSQL, zero external dependencies
- **Multi-User** — Parent and kid accounts with role-based access

## Docker Quick Start (Recommended)

1. Clone and enter the repo:

```bash
git clone https://github.com/zaheria985/harmony_homeschool.git
cd harmony_homeschool
```

2. Create your env file:

```bash
cp .env.example .env
```

3. Set at least:
- `POSTGRES_PASSWORD`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (for local Docker use `http://localhost:3000`)
- `APP_TIMEZONE` — your family's IANA timezone (default `America/Chicago`). Every
  server-side "what day is it" decision uses it.

Two more are worth setting now, because the features they gate fail closed
rather than running insecurely:
- `CRON_SECRET` — without it the nightly lesson bump and daily digest do not run
  (the dashboard falls back to bumping at most once a day on page load).
- `CALENDAR_ICAL_TOKEN` — without it `/api/calendar/ical` returns 403. The feed
  exposes every child's schedule to anyone with the URL, so the token *is* the
  access control.

4. Start the default stack (app + PostgreSQL):

```bash
docker compose pull
docker compose up -d
```

5. Open `http://localhost:3000`

**Create your first account.** Public signup is disabled by default, but is
allowed while the database has no users — so on a brand-new install just visit
`http://localhost:3000/signup` and create your parent account. After that,
signup closes automatically.

To reopen it later (e.g. to add another parent), set `SIGNUP_ENABLED=true` in
`.env` — optionally with `SIGNUP_INVITE_CODE` — and turn it back off afterwards.

## Docker Compose Options

### Option A: App + Database in one stack (default `docker-compose.yml`)

Abridged below — the file in the repo also runs two sidecars: `cron` (nightly
lesson bump and daily digest, needs `CRON_SECRET`) and `backup` (nightly
`pg_dump`, see [Backups](#backups)).

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: harmony
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: harmony
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    image: ${APP_IMAGE:-ghcr.io/zaheria985/harmony_homeschool:latest}
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://harmony:${POSTGRES_PASSWORD}@db:5432/harmony
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
      BOOTSTRAP_SCHEMA: ${BOOTSTRAP_SCHEMA:-1}
      SEED_DEFAULT_USER: ${SEED_DEFAULT_USER:-0}
    ports:
      - "3000:3000"
    volumes:
      - uploads:/app/public/uploads

volumes:
  pgdata:
  uploads:
```

Run it:

```bash
docker compose pull
docker compose up -d
```

### Option B: App-only stack (use your own external PostgreSQL)

Use `docker-compose.app.yml`:

```yaml
version: "3.8"

services:
  app:
    image: ${APP_IMAGE:-ghcr.io/zaheria985/harmony_homeschool:latest}
    restart: unless-stopped
    environment:
      DATABASE_URL: ${DATABASE_URL:?Set DATABASE_URL in .env}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?Set NEXTAUTH_SECRET in .env}
      NEXTAUTH_URL: ${NEXTAUTH_URL:?Set NEXTAUTH_URL in .env}
      LLM_PROVIDER: ${LLM_PROVIDER:-openai}
      LLM_API_KEY: ${LLM_API_KEY:-}
      LLM_BASE_URL: ${LLM_BASE_URL:-https://api.openai.com/v1}
      UPLOADS_DIR: /app/public/uploads
    volumes:
      - uploads:/app/public/uploads
    ports:
      - "3000:3000"

volumes:
  uploads:
```

Run it:

```bash
docker compose -f docker-compose.app.yml pull
docker compose -f docker-compose.app.yml up -d
```

For this mode, set `DATABASE_URL` in `.env` to your external PostgreSQL connection string.

Advanced/production-oriented compose (healthchecks, seed mount, uploads volume, extra envs) is available in `docker-compose.full.yml` and can be run with:

```bash
docker compose -f docker-compose.full.yml pull
docker compose -f docker-compose.full.yml up -d
```

### Option C: Unraid (Compose Manager)

If you're using Unraid's Docker Compose Manager, paste this YAML directly into the stack editor.
**Do not** mount `./db/*.sql` files — the image bootstraps the database automatically on first boot.

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: harmony
      POSTGRES_PASSWORD: harmony
      POSTGRES_DB: harmony
    volumes:
      - /mnt/user/appdata/harmony/db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U harmony -d harmony"]
      interval: 5s
      timeout: 3s
      retries: 20

  app:
    image: ghcr.io/zaheria985/harmony_homeschool:latest
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://harmony:harmony@db:5432/harmony
      NEXTAUTH_SECRET: change-me-to-a-random-string
      NEXTAUTH_URL: http://YOUR_UNRAID_IP:3432
      BOOTSTRAP_SCHEMA: "1"
      # Leave at "0" and create your account at /signup on first visit.
      # Setting "1" creates the publicly-known parent@harmony.local /
      # harmony123 login — change its password immediately if you do.
      SEED_DEFAULT_USER: "0"
    ports:
      - "3432:3000"
    volumes:
      - /mnt/user/appdata/harmony/app:/app/public/uploads
```

Replace `YOUR_UNRAID_IP` with your server's IP address (e.g. `192.168.1.100`).

**How it works:** On first startup the app container automatically:
- Waits for Postgres to be ready
- Applies the full schema if the database is empty
- Runs any pending migrations
- Leaves account creation to you — visit `/signup` on first load to create the
  first parent account (enable the legacy demo login with `SEED_DEFAULT_USER: "1"`)

**Set up backups.** The stack above has none. See
[Backups on Unraid](#backups-on-unraid) — the `backup` service from
`docker-compose.yml` will not work here, and there is a drop-in replacement.

## Docker Image Publishing

- Image: `ghcr.io/zaheria985/harmony_homeschool`
- `latest` is published automatically from `main` via `.github/workflows/docker-publish.yml`.
- Every publish also includes a short SHA tag.

If you want to build locally instead of pulling the prebuilt image:

```bash
docker compose up --build -d
```

## Local Dev (Without Docker)

1. Install dependencies:

```bash
npm install
```

2. Copy environment config:

```bash
cp .env.example .env
```

3. Set required values in `.env`:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

4. Apply database schema and migrations:

```bash
npm run db:migrate
```

5. Seed local demo data (optional, **destructive** — deletes all existing data,
   so never run this against a database you care about):

```bash
SEED_DEMO=true npm run db:seed
```

6. Start development server:

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Key Scripts

- `npm run dev` - Run local Next.js dev server
- `npm run lint` - Run lint checks
- `npm run build` - Build production app
- `npm run db:migrate` - Apply schema and SQL migrations
- `npm run db:check` - Validate migration state without applying
- `npm run db:seed` - Seed demo data (**destructive**; requires `SEED_DEMO=true`)

## Database Notes

- PostgreSQL is required.
- Migrations are tracked in `db/migrations` and applied by `db/migrate.js`.
- Schema source is `db/schema.sql`.
- ⚠️ `npm run db:seed` is **destructive** — it deletes all data and installs a
  demo family. It refuses to run unless `SEED_DEMO=true`.

### Backups on Unraid

⚠️ The `backup` service in `docker-compose.yml` **does not work as-is under
Unraid's Compose Manager.** It mounts `./scripts/backup.sh` and `./backups`,
which are relative to the compose project directory — on Unraid that lives on
the **USB boot flash**. The script file will not exist (you paste YAML rather
than clone the repo), and nightly dumps would be written to the boot flash.

Use this self-contained service instead. It needs no repo files and writes to
the array:

```yaml
  backup:
    image: postgres:16-alpine
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGHOST: db
      PGUSER: harmony
      PGPASSWORD: harmony        # match POSTGRES_PASSWORD in the db service
      PGDATABASE: harmony
      KEEP_DAYS: "14"
    volumes:
      - /mnt/user/backups/harmony:/backups
    entrypoint:
      - sh
      - -c
      - |
        while true; do
          f=/backups/harmony-$$(date -u +%Y%m%d-%H%M%S).dump
          echo "[backup] $$(date -u) -> $$f"
          if pg_dump -Fc -f "$$f.partial"; then
            mv "$$f.partial" "$$f"
            find /backups -name 'harmony-*.dump' -mtime +$$KEEP_DAYS -delete
          else
            rm -f "$$f.partial"; echo "[backup] FAILED"
          fi
          sleep 86400
        done
```

Create the destination first (Unraid terminal): `mkdir -p /mnt/user/backups/harmony`

Put it on a share that is **not** `appdata`, so it is covered by your normal
share backups and survives an appdata restore. Dumps are written to a
`.partial` name first, so an interrupted run never leaves a file that looks
complete.

**Manual backup, any time** — find the container, then dump. Do **not** pass
`-t`: a TTY corrupts the binary dump.

```bash
docker ps --format '{{.Names}}' | grep -i harmony
```

```bash
mkdir -p /mnt/user/backups/harmony && docker exec harmony-db-1 pg_dump -U harmony -Fc harmony > "/mnt/user/backups/harmony/manual-$(date +%Y%m%d-%H%M%S).dump"
```

**Restore** (overwrites current data — take a fresh dump first):

```bash
docker exec -i harmony-db-1 pg_restore -U harmony -d harmony --clean --if-exists < /mnt/user/backups/harmony/harmony-YYYYMMDD-HHMMSS.dump
```

**Verify a dump without touching live data:**

```bash
docker exec -i harmony-db-1 createdb -U harmony harmony_verify && docker exec -i harmony-db-1 pg_restore -U harmony -d harmony_verify < /mnt/user/backups/harmony/harmony-YYYYMMDD-HHMMSS.dump && docker exec -i harmony-db-1 psql -U harmony -d harmony_verify -c "SELECT count(*) FROM children; SELECT count(*) FROM lessons;" && docker exec -i harmony-db-1 dropdb -U harmony harmony_verify
```

Replace `harmony-db-1` with the name from the `docker ps` command above —
Compose Manager derives it from your stack name.

Unraid's **CA Appdata Backup** plugin complements this but does not replace it:
it archives the Postgres data directory, ideally with the container stopped,
whereas `pg_dump` produces a consistent logical dump from a running database
and can restore a single table.

## Daily Digest (Home Assistant)

The cron sidecar can POST a "what's due today" summary to a webhook each
morning. Set `HA_WEBHOOK_URL` in `.env`; leave it unset and the job is a no-op.

Preview the payload without sending it:

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/daily-digest?dry=1" | jq
```

The payload looks like:

```json
{
  "date": "2026-07-22",
  "totalDueToday": 7,
  "totalOverdue": 2,
  "summary": "Emma: 4 due, 1 overdue \u00b7 Noah: 3 due",
  "children": [
    { "childName": "Emma", "dueToday": 4, "overdue": 1,
      "lessons": [{ "title": "Fractions review", "course": "Math 5", "overdue": false }] }
  ]
}
```

On the Home Assistant side, create a webhook automation and use `summary`
directly, or build your own message from `children`:

```yaml
automation:
  - alias: Harmony daily digest
    trigger:
      - platform: webhook
        webhook_id: harmony-digest
        allowed_methods: [POST]
        local_only: true
    action:
      - service: notify.mobile_app_applejack
        data:
          title: "School today"
          message: "{{ trigger.json.summary }}"
```

Then set `HA_WEBHOOK_URL=https://<your-ha-host>/api/webhook/harmony-digest`.
Timing is `DIGEST_HOUR` (UTC, default `12` = 7am CDT / 6am CST).

## Backups

The `backup` service in `docker-compose.yml` runs a nightly `pg_dump` into
`./backups` on the host and keeps the last 14 days. It starts with one
immediate backup so you get a dump as soon as the stack comes up.

Tune with env vars: `BACKUP_HOUR` (0–23 **UTC**, default `8` = 3am CDT / 2am
CST) and `BACKUP_KEEP_DAYS` (default `14`).

Note both scheduled jobs use **UTC** hours, while the app's date logic uses
`APP_TIMEZONE` (default `America/Chicago`). The lesson-bump cron defaults to
`BUMP_HOUR=23` (6pm CDT / 5pm CST) so it runs after the school day.

**Check it is working:**

```bash
docker compose logs backup --tail 20 && ls -lh backups/
```

**Take a backup right now, on demand:**

```bash
docker compose exec -T db pg_dump -U harmony -Fc harmony > "backups/manual-$(date +%Y%m%d-%H%M%S).dump"
```

**Restore a dump** (this overwrites current data — take a fresh backup first):

```bash
docker compose exec -T db pg_restore -U harmony -d harmony --clean --if-exists < backups/harmony-YYYYMMDD-HHMMSS.dump
```

**Verify a dump without touching live data** — restore it into a scratch
database and check the row counts look sane:

```bash
docker compose exec -T db createdb -U harmony harmony_verify
docker compose exec -T db pg_restore -U harmony -d harmony_verify < backups/harmony-YYYYMMDD-HHMMSS.dump
docker compose exec -T db psql -U harmony -d harmony_verify -c "SELECT count(*) AS children FROM children; SELECT count(*) AS lessons FROM lessons;"
docker compose exec -T db dropdb -U harmony harmony_verify
```

`./backups` is gitignored — the dumps contain real family data, so never commit
them. Copy them off the machine as well; a backup on the same disk as the
database does not survive a disk failure.

## Environment Variables

See `docs/ENVIRONMENT.md` for full variable reference and provider-specific examples.

## Troubleshooting

- Login loop or auth failures:
  - Verify `NEXTAUTH_URL` matches the URL you open in the browser.
  - Ensure `NEXTAUTH_SECRET` is set and stable.
- Database connection errors:
  - Confirm PostgreSQL is running.
  - Verify `DATABASE_URL` credentials and host/port.
- Missing tables/columns:
  - Run `npm run db:migrate`.
