import { db } from "@/db/client";
import { companies, specialistFavorites } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { fail } from "@/server/http";

export async function listSpecialistFavorites(specialistUserId: string) {
  const rows = await db.select({
    companyId: companies.id,
    name: companies.name,
    description: companies.description,
    industry: companies.industry,
    workFormat: companies.workFormat,
    logoFileId: companies.logoFileId,
    websiteUrl: companies.websiteUrl,
    createdAt: specialistFavorites.createdAt,
  }).from(specialistFavorites)
    .innerJoin(companies, eq(companies.id, specialistFavorites.companyId))
    .where(eq(specialistFavorites.specialistUserId, specialistUserId))
    .orderBy(desc(specialistFavorites.createdAt));
  return { items: rows };
}

export async function addSpecialistFavorite(specialistUserId: string, companyId: string) {
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, companyId));
  if (!company) fail(404, "COMPANY_NOT_FOUND", "Компания не найдена");
  await db.insert(specialistFavorites).values({ specialistUserId, companyId }).onConflictDoNothing();
  return { ok: true };
}

export async function removeSpecialistFavorite(specialistUserId: string, companyId: string) {
  await db.delete(specialistFavorites).where(and(
    eq(specialistFavorites.specialistUserId, specialistUserId),
    eq(specialistFavorites.companyId, companyId),
  ));
}
