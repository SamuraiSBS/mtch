import { pool } from "@/db/client";
export const runtime = "nodejs";
export async function GET() { try { await pool.query("select 1"); return Response.json({ status: "ok", database: "ok" }); } catch { return Response.json({ status: "error", database: "unavailable" }, { status: 503 }); } }
