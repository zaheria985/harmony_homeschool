import { Pool } from "pg";
import { hashSync } from "bcryptjs";

const email = process.argv[2];
const password = process.argv[3];
const childName = process.argv[4];

if (!email || !password || !childName) {
  console.error("Usage: tsx db/create-kid-account.ts <email> <password> <childName>");
  process.exit(1);
}

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://harmony:claude@localhost:5432/harmony",
});

async function run() {
  const client = await pool.connect();
  try {
    const childRes = await client.query(
      `SELECT id, name FROM children WHERE lower(name) = lower($1) LIMIT 1`,
      [childName]
    );
    if (!childRes.rows[0]) {
      throw new Error(`Child '${childName}' not found`);
    }

    const passwordHash = hashSync(password, 10);
    await client.query(
      `INSERT INTO users (email, password_hash, name, role, child_id)
       VALUES ($1, $2, $3, 'kid', $4)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             name = EXCLUDED.name,
             role = 'kid',
             child_id = EXCLUDED.child_id`,
      [email, passwordHash, childRes.rows[0].name, childRes.rows[0].id]
    );

    console.log(`Kid account ready: ${email}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to create kid account");
  process.exit(1);
});
