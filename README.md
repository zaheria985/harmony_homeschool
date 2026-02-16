# Harmony Homeschool

A self-hosted web app for planning homeschool lessons, tracking completion, and reviewing progress.

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

4. Start the default stack (app + PostgreSQL):

```bash
docker compose pull
docker compose up -d
```

5. Open `http://localhost:3000`

**Default login:**
- Email: `parent@harmony.local`
- Password: `harmony123`

## Docker Compose Options

### Option A: App + Database in one stack (default `docker-compose.yml`)

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
      SEED_DEFAULT_USER: ${SEED_DEFAULT_USER:-1}
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
      FILERUN_BASE_URL: ${FILERUN_BASE_URL:-}
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
      SEED_DEFAULT_USER: "1"
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
- Seeds a default login account (disable with `SEED_DEFAULT_USER: "0"`)

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

5. Seed local demo data:

```bash
npm run db:seed
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
- `npm run db:seed` - Seed sample data

## Database Notes

- PostgreSQL is required.
- Migrations are tracked in `db/migrations` and applied by `db/migrate.js`.
- Schema source is `db/schema.sql`.

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
