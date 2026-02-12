# Harmony Homeschool

A Next.js app for planning homeschool lessons, tracking completion, and reviewing progress.

## Quick Start

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

Default seeded account: `parent@harmony.local` / `harmony123`.

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
