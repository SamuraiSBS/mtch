import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
const globalDb = globalThis as unknown as { mtchPool?: Pool };
export const pool = globalDb.mtchPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalDb.mtchPool = pool;
export const db = drizzle(pool, { schema });
