const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const CRITICAL_COLUMNS = [
  {
    table: "subjects",
    column: "thumbnail_url",
    reason: "Required by subjects listing/detail UI and subject edit actions.",
  },
];

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files.filter((file) => file.endsWith(".sql")).sort();
}

async function getAppliedMigrations(pool) {
  const res = await pool.query("SELECT filename FROM schema_migrations");
  return new Set(res.rows.map((row) => row.filename));
}

async function applyMigration(pool, filename) {
  const client = await pool.connect();
  try {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = await fs.readFile(filePath, "utf8");

    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
      [filename]
    );
    await client.query("COMMIT");
    console.log(`Applied migration: ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations(pool) {
  await ensureMigrationsTable(pool);

  const files = await getMigrationFiles();
  const applied = await getAppliedMigrations(pool);

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    await applyMigration(pool, file);
  }

  if (files.length === 0) {
    console.log("No migration files found.");
  } else {
    console.log("Migrations up to date.");
  }
}

async function checkCriticalColumns(pool) {
  const missing = [];

  for (const item of CRITICAL_COLUMNS) {
    const res = await pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = $2
       ) AS present`,
      [item.table, item.column]
    );

    if (!res.rows[0]?.present) {
      missing.push(item);
    }
  }

  if (missing.length > 0) {
    const lines = missing.map(
      (item) => `- ${item.table}.${item.column}: ${item.reason}`
    );
    const message = [
      "Schema drift detected. Required columns are missing:",
      ...lines,
      "Run `npm run db:migrate` (or restart Docker app service) to apply migrations.",
    ].join("\n");

    throw new Error(message);
  }

  console.log("Schema check passed: required columns are present.");
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations/checks.");
  }

  const pool = new Pool({ connectionString });

  try {
    if (checkOnly) {
      await checkCriticalColumns(pool);
      return;
    }

    await runMigrations(pool);
    await checkCriticalColumns(pool);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
