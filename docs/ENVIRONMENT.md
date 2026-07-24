# Environment Variables

This project reads configuration from `.env`. Everything outside "Required" has
a working default or disables a feature when unset.

## Required

- `DATABASE_URL`
  - PostgreSQL connection string.
  - Example: `postgresql://harmony:changeme@localhost:5432/harmony`
  - In the Docker stack this is built from `POSTGRES_PASSWORD`.

- `NEXTAUTH_SECRET`
  - Signs auth tokens and cookies. The compose file refuses to start without it.
  - Generate with:
    ```bash
    openssl rand -base64 32
    ```

- `NEXTAUTH_URL`
  - Canonical app URL used by NextAuth callback handling.
  - Local example: `http://localhost:3000`

- `POSTGRES_PASSWORD`
  - Password for the bundled Postgres container. Not needed if `DATABASE_URL`
    points at a database you manage yourself.

## Localization

- `APP_TIMEZONE`
  - IANA zone for server-side "today" (default `America/Chicago`). Set it to the
    family's zone; an invalid value falls back to the default with a warning.
  - Note: scheduled-job *hours* below are UTC regardless of this setting.

## Scheduled jobs

- `CRON_SECRET`
  - Shared secret for `/api/cron/bump-lessons` and `/api/cron/daily-digest`.
    Send as `x-cron-secret: <value>` or `authorization: Bearer <value>`.
  - Unset means no scheduled bumping; the dashboard falls back to bumping at
    most once a day on render.

- `BUMP_HOUR` (default `23`), `DIGEST_HOUR` (default `12`), `BACKUP_HOUR`
  (default `8`)
  - Hour of day, 0–23, **UTC**, for the cron and backup sidecars.
  - `BUMP_HOUR` must not land near local midnight — the bump includes today.

- `HA_WEBHOOK_URL`
  - Where the daily digest is POSTed (a Home Assistant webhook). No URL, no
    digest.

- `BACKUP_DIR` (default `/backups`), `KEEP_DAYS` (default `14`)
  - Used by `scripts/backup.sh` in the backup sidecar.

## Accounts and signup

- `SIGNUP_ENABLED`
  - `true` opens public signup. Otherwise signup is available only while the
    `users` table is empty (first-run bootstrap).

- `SIGNUP_INVITE_CODE`
  - When set, signup additionally requires this code.

- `SEED_DEFAULT_USER` (default on)
  - Applies `db/seed-default-user.sql` when bootstrapping an empty database.
    Set to `0` to skip it. **Rotate the seeded password immediately.**

- `SEED_DEMO`, `SEED_DEMO_PASSWORD`
  - `SEED_DEMO=true` loads demo data via `db/seed.ts`. Leave off for real use.

## Calendar feed

- `CALENDAR_ICAL_TOKEN`
  - Required for `/api/calendar/ical`. Without it the endpoint returns 403 —
    the feed is unauthenticated by nature, so the token *is* the access control.
  - `ICAL_TOKEN` is honored as a legacy alias.

## Uploads

- `UPLOADS_DIR`
  - Where uploaded files are written (a Docker volume in the default stack).

## Database bootstrap

- `BOOTSTRAP_SCHEMA` (default on)
  - Applies `db/schema.sql` when the `users` table is missing. Set to `0` to
    require an already-initialized database.

- `DB_WAIT_MAX_MS` (default `60000`), `DB_WAIT_POLL_MS` (default `1000`)
  - How long bootstrap waits for Postgres to accept connections.

## LLM integration (optional)

- `LLM_PROVIDER` — `openai`, `claude`, or `openai_compatible`
- `LLM_API_KEY` — API key; unset disables every AI feature
- `LLM_BASE_URL` — provider endpoint (OpenAI default: `https://api.openai.com/v1`)
- `LLM_MODEL` — model identifier (e.g. `gpt-4o`, `claude-sonnet-4-5-20250929`)

## Trello import (optional)

- `TRELLO_API_KEY`, `TRELLO_TOKEN`
  - Credentials for the Trello board importer under `/admin/trello`.

## Recommended baseline .env

```env
DATABASE_URL=postgresql://harmony:changeme@localhost:5432/harmony
POSTGRES_PASSWORD=changeme

NEXTAUTH_SECRET=replace-with-generated-secret
NEXTAUTH_URL=http://localhost:3000

APP_TIMEZONE=America/Chicago

CRON_SECRET=replace-with-a-long-random-secret
CALENDAR_ICAL_TOKEN=replace-with-a-long-random-token
```
