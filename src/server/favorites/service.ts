import { db } from "@/db/client";
import { companies, employerSpecialistFavorites, offers, practiceInvitations, specialistFavorites, specialistProfiles } from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { fail } from "@/server/http";
import { specialistDetail } from "@/server/specialists/service";

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

export async function listEmployerFavorites(employerUserId: string) {
  const rows = await db.select({ specialistUserId: employerSpecialistFavorites.specialistUserId })
    .from(employerSpecialistFavorites)
    .where(eq(employerSpecialistFavorites.employerUserId, employerUserId))
    .orderBy(desc(employerSpecialistFavorites.createdAt));
  const [interestRows, practiceRows] = await Promise.all([db.select({ id: offers.id, specialistUserId: offers.specialistUserId, status: offers.status })
    .from(offers)
    .where(and(eq(offers.employerUserId, employerUserId), ne(offers.status, "REJECTED"), ne(offers.status, "WITHDRAWN"))),
  db.select({ candidateUserId: practiceInvitations.candidateUserId, status: practiceInvitations.status })
    .from(practiceInvitations)
    .where(eq(practiceInvitations.employerUserId, employerUserId))
    .orderBy(desc(practiceInvitations.createdAt))]);
  const interests = new Map(interestRows.map(row => [row.specialistUserId, row]));
  const activePracticeStatuses = new Set(["SENT", "VIEWED", "ACCEPTED", "INTERVIEW", "HIRED"]);
  const practiceStatuses = new Map<string, string>();
  for (const row of practiceRows) if (activePracticeStatuses.has(row.status) && !practiceStatuses.has(row.candidateUserId)) practiceStatuses.set(row.candidateUserId, row.status);
  const items = await Promise.all(rows.map(row => specialistDetail(row.specialistUserId)));
  return { items: items.map(profile => ({
    ...profile,
    isFavorite: true,
    interestStatus: interests.get(profile.userId)?.status ?? null,
    interestOfferId: interests.get(profile.userId)?.id ?? null,
    practiceInvitationStatus: practiceStatuses.get(profile.userId) ?? null,
  })) };
}

export async function addEmployerFavorite(employerUserId: string, specialistUserId: string) {
  const [profile] = await db.select({ userId: specialistProfiles.userId }).from(specialistProfiles).where(eq(specialistProfiles.userId, specialistUserId));
  if (!profile) fail(404, "SPECIALIST_NOT_FOUND", "Профиль исполнителя не найден");
  await db.insert(employerSpecialistFavorites).values({ employerUserId, specialistUserId }).onConflictDoNothing();
  return { ok: true };
}

export async function removeEmployerFavorite(employerUserId: string, specialistUserId: string) {
  await db.delete(employerSpecialistFavorites).where(and(
    eq(employerSpecialistFavorites.employerUserId, employerUserId),
    eq(employerSpecialistFavorites.specialistUserId, specialistUserId),
  ));
}
