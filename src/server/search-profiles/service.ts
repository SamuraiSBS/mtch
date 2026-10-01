import { db } from "@/db/client";
import { searchProfiles, searchProfileSkills, skills } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { fail } from "@/server/http";
import { searchInput, parse } from "@/server/validation";
import { requireCatalogId, requireSkills } from "@/server/catalogs/service";
import { ownCompany } from "@/server/companies/service";

export async function ownSearchProfile(ownerUserId: string, id: string, allowDeleted = false) { const company = await ownCompany(ownerUserId); const [profile] = await db.select().from(searchProfiles).where(and(eq(searchProfiles.id, id), eq(searchProfiles.companyId, company.id))); if (!profile || (profile.deletedAt && !allowDeleted)) fail(404, "SEARCH_PROFILE_NOT_FOUND", "Профиль поиска не найден"); return profile; }
export async function searchDetail(ownerUserId: string, id: string) { const profile = await ownSearchProfile(ownerUserId, id); const chosen = await db.select({ id: skills.id, name: skills.name }).from(searchProfileSkills).innerJoin(skills, eq(skills.id, searchProfileSkills.skillId)).where(eq(searchProfileSkills.searchProfileId, id)); return { ...profile, skills: chosen, skillIds: chosen.map(x => x.id) }; }
export async function listSearchProfiles(ownerUserId: string) { const company = await ownCompany(ownerUserId); const rows = await db.select().from(searchProfiles).where(and(eq(searchProfiles.companyId, company.id), isNull(searchProfiles.deletedAt))).orderBy(searchProfiles.createdAt); return Promise.all(rows.map(x => searchDetail(ownerUserId, x.id))); }
export async function saveSearchProfile(ownerUserId: string, id: string | null, input: unknown) {
  const data = parse(searchInput, input); await requireCatalogId("professions", data.professionId); await requireSkills(data.skillIds); const company = await ownCompany(ownerUserId);
  if (id) await ownSearchProfile(ownerUserId, id);
  const { skillIds, ...fields } = data;
  const profileId = await db.transaction(async tx => {
    let resultId = id;
    if (id) await tx.update(searchProfiles).set({ ...fields, updatedAt: new Date() }).where(eq(searchProfiles.id, id));
    else { const [row] = await tx.insert(searchProfiles).values({ ...fields, companyId: company.id }).returning({ id: searchProfiles.id }); resultId = row.id; }
    await tx.delete(searchProfileSkills).where(eq(searchProfileSkills.searchProfileId, resultId!));
    await tx.insert(searchProfileSkills).values(skillIds.map(skillId => ({ searchProfileId: resultId!, skillId })));
    return resultId!;
  });
  return searchDetail(ownerUserId, profileId);
}
export async function removeSearchProfile(ownerUserId: string, id: string) { await ownSearchProfile(ownerUserId, id); await db.update(searchProfiles).set({ deletedAt: new Date() }).where(eq(searchProfiles.id, id)); }
