import { Client } from "pg";

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function mustReject(sql: string, id: string, expectedMessage: string) {
  await client.query("BEGIN");
  let rejected = false;
  try {
    await client.query(sql, [id]);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes(expectedMessage)) throw error;
    rejected = true;
  } finally {
    await client.query("ROLLBACK");
  }
  if (!rejected) throw new Error(`Database accepted a forbidden update: ${expectedMessage}`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await client.connect();
  try {
    const users = await client.query<{ id: string; role: string }>('SELECT id, role FROM "user" LIMIT 1');
    const offers = await client.query<{ id: string }>("SELECT id FROM offers LIMIT 1");
    if (!users.rows[0] || !offers.rows[0]) throw new Error("Seed users and offers are required");
    await mustReject('UPDATE "user" SET role = (CASE role WHEN \'SPECIALIST\' THEN \'EMPLOYER\' ELSE \'SPECIALIST\' END)::user_role WHERE id = $1', users.rows[0].id, "user role is immutable");
    await mustReject("UPDATE offers SET position_title = position_title || ' changed' WHERE id = $1", offers.rows[0].id, "offer terms are immutable");
    console.log("Database integrity passed: role and sent offer terms are immutable.");
  } finally {
    await client.end();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
