import { db } from "@/db/client";
import { companies, specialistProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jsonError, requireUser } from "@/server/http";
export async function GET(request: Request) { try { const user = await requireUser(request); const hasProfile = user.role === "SPECIALIST" ? (await db.select({ id: specialistProfiles.userId }).from(specialistProfiles).where(eq(specialistProfiles.userId, user.id))).length > 0 : false; const hasCompany = user.role === "EMPLOYER" ? (await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerUserId, user.id))).length > 0 : false; return Response.json({ id: user.id, email: user.email, role: user.role, hasProfile, hasCompany }); } catch (error) { return jsonError(error); } }
