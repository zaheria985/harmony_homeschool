import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// An error on an *idle* client (database restart, network blip, an idle
// connection killed by the server) is emitted on the pool. Without a listener
// Node treats it as an unhandled 'error' event and crashes the whole process,
// taking the app down for what is usually a recoverable hiccup — the pool
// discards the bad client and the next query opens a fresh one.
pool.on("error", (err) => {
  console.error("[db] idle client error (connection discarded):", err.message);
});

export default pool;
