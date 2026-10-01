import { db } from "@/db/client";
import { specialistProfiles } from "@/db/schema";
import { ne } from "drizzle-orm";
import { z } from "zod";
import { fail, pageParams, paged } from "@/server/http";
import { specialistDetail } from "@/server/specialists/service";
import { searchDetail } from "@/server/search-profiles/service";
import { deterministicScorer, experienceRank, type CandidateCriteria } from "@/server/matching/scorer";

export async function candidateFeed(ownerUserId: string, url: string) {
  const params = new URL(url).searchParams; const searchProfileId = params.get("searchProfileId");
  if (!searchProfileId || !z.uuid().safeParse(searchProfileId).success) return fail(422, "SEARCH_PROFILE_REQUIRED", "Выберите профиль поиска");
  const search = await searchDetail(ownerUserId, searchProfileId); const { page, pageSize } = pageParams(url);
  const enumFilter = <T extends string>(name: string, allowed: readonly T[]) => { const value = params.get(name); if (value && !allowed.includes(value as T)) fail(422, "INVALID_FILTER", `Некорректный фильтр ${name}`); return value; };
  const level = enumFilter("level", ["INTERN", "JUNIOR", "MIDDLE", "SENIOR"]);
  const minimumExperience = enumFilter("minimumExperience", ["NONE", "UNDER_1", "FROM_1_TO_3", "FROM_3_TO_5", "OVER_5"]);
  const workFormat = enumFilter("workFormat", ["REMOTE", "HYBRID", "OFFICE"]);
  const searchStatus = enumFilter("searchStatus", ["ACTIVE", "OPEN_TO_OFFERS"]);
  const professionId = params.get("professionId"), cityId = params.get("cityId"), skillIds = params.getAll("skillId");
  for (const id of [professionId, cityId, ...skillIds].filter(Boolean)) if (!z.uuid().safeParse(id).success) fail(422, "INVALID_FILTER", "Некорректный ID фильтра");
  const salaryMin = params.get("salaryMinRub"), salaryMax = params.get("salaryMaxRub");
  if ((salaryMin === null) !== (salaryMax === null)) fail(422, "INVALID_SALARY_FILTER", "Нужны обе границы зарплаты");
  const min = salaryMin === null ? null : Number(salaryMin), max = salaryMax === null ? null : Number(salaryMax);
  if (min !== null && (!Number.isInteger(min) || !Number.isInteger(max) || min <= 0 || max! < min)) fail(422, "INVALID_SALARY_FILTER", "Некорректный диапазон зарплаты");
  const all = await db.select({ userId: specialistProfiles.userId }).from(specialistProfiles).where(ne(specialistProfiles.searchStatus, "NOT_LOOKING"));
  const candidates = await Promise.all(all.map(x => specialistDetail(x.userId)));
  const filtered = candidates.filter(candidate => {
    if (professionId && candidate.professionId !== professionId) return false;
    if (cityId && candidate.cityId !== cityId) return false;
    if (level && candidate.level !== level) return false;
    if (minimumExperience && (!candidate.experience || experienceRank[candidate.experience] < experienceRank[minimumExperience as keyof typeof experienceRank])) return false;
    if (workFormat && candidate.workFormat !== workFormat) return false;
    if (searchStatus && candidate.searchStatus !== searchStatus) return false;
    if (skillIds.some(id => !candidate.skills.some(s => s.id === id))) return false;
    if (min !== null && !(candidate.salaryMinRub <= max! && min <= candidate.salaryMaxRub)) return false;
    return true;
  });
  const scored = filtered.map(candidate => {
    const score = deterministicScorer.score({ ...search, skillIds: search.skillIds }, { ...candidate, skillIds: candidate.skills.map(x => x.id) } as CandidateCriteria);
    return { userId: candidate.userId, avatarUrl: `${candidate.avatarUrl}?size=256`, firstName: candidate.firstName, lastName: candidate.lastName, profession: candidate.profession, level: candidate.level, experience: candidate.experience, skills: candidate.skills.slice(0, 6), salaryMinRub: candidate.salaryMinRub, salaryMaxRub: candidate.salaryMaxRub, matchPercent: score };
  }).sort((a, b) => b.matchPercent - a.matchPercent || a.userId.localeCompare(b.userId));
  return paged(scored, page, pageSize);
}
