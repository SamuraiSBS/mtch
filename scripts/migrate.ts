import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/db/client";
async function main() { await migrate(db, { migrationsFolder: "./drizzle" }); console.log("Migrations complete"); await pool.end(); }
main().catch(error => { console.error(error); process.exit(1); });
