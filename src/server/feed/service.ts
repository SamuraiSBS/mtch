import { db } from "@/db/client";
import { employerSpecialistFavorites, offers, practiceInvitations, specialistProfiles } from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { fail, pageParams, paged } from "@/server/http";
import { specialistDetail } from "@/server/specialists/service";
import { searchDetail } from "@/server/search-profiles/service";
import { deterministicScorer, experienceRank, type CandidateCriteria } from "@/server/matching/scorer";

function integerFilter(params: URLSearchParams, name: string, min: number, max: number) {
  const raw = params.get(name);
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) fail(422, "INVALID_FILTER", `Некорректный фильтр ${name}`);
  return value;
}

export async function candidateFeed(ownerUserId: string, url: string) {
  const params = new URL(url).searchParams;
  const searchProfileId = params.get("searchProfileId");
  if (searchProfileId && !z.uuid().safeParse(searchProfileId).success) fail(422, "INVALID_FILTER", "Некорректный профиль поиска");
  const search = searchProfileId ? await searchDetail(ownerUserId, searchProfileId) : null;
  const { page, pageSize } = pageParams(url);
  const enumFilter = <T extends string>(name: string, allowed: readonly T[]) => {
    const value = params.get(name);
    if (value && !allowed.includes(value as T)) fail(422, "INVALID_FILTER", `Некорректный фильтр ${name}`);
    return value;
  };
  const level = enumFilter("level", ["INTERN", "JUNIOR", "MIDDLE", "SENIOR"]);
  const minimumExperience = enumFilter("minimumExperience", ["NONE", "UNDER_1", "FROM_1_TO_3", "FROM_3_TO_5", "OVER_5"]);
  const workFormat = enumFilter("workFormat", ["REMOTE", "HYBRID", "OFFICE"]);
  const employmentType = enumFilter("employmentType", ["FULL_TIME", "PART_TIME", "PROJECT", "INTERNSHIP"]);
  const searchStatus = enumFilter("searchStatus", ["ACTIVE", "OPEN_TO_OFFERS"]);
  const employmentGoal = enumFilter("employmentGoal", ["JOB", "INTERNSHIP", "PRACTICE", "OPEN_TO_OFFERS"]);
  const professionId = params.get("professionId"), cityId = params.get("cityId"), skillIds = params.getAll("skillId");
  for (const id of [professionId, cityId, ...skillIds].filter(Boolean)) if (!z.uuid().safeParse(id).success) fail(422, "INVALID_FILTER", "Некорректный фильтр");
  const salaryMin = integerFilter(params, "salaryMinRub", 1, 100_000_000);
  const salaryMax = integerFilter(params, "salaryMaxRub", 1, 100_000_000);
  const ageMin = integerFilter(params, "ageMin", 1, 120);
  const ageMax = integerFilter(params, "ageMax", 1, 120);
  if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) fail(422, "INVALID_FILTER_RANGE", "Максимальная зарплата меньше минимальной");
  if (ageMin !== null && ageMax !== null && ageMax < ageMin) fail(422, "INVALID_FILTER_RANGE", "Максимальный возраст меньше минимального");
  const query = (params.get("q") ?? "").normalize("NFKC").trim().toLocaleLowerCase("ru-RU").slice(0, 160);

  const all = await db.select({ userId: specialistProfiles.userId }).from(specialistProfiles).where(ne(specialistProfiles.searchStatus, "NOT_LOOKING"));
  const candidates = await Promise.all(all.map(row => specialistDetail(row.userId)));
  const filtered = candidates.filter(candidate => {
    if (professionId && candidate.professionId !== professionId) return false;
    if (cityId && candidate.cityId !== cityId) return false;
    if (level && candidate.level !== level) return false;
    if (minimumExperience && (!candidate.experience || experienceRank[candidate.experience] < experienceRank[minimumExperience as keyof typeof experienceRank])) return false;
    if (workFormat && candidate.workFormat !== workFormat) return false;
    if (employmentType && candidate.employmentType !== employmentType) return false;
    if (searchStatus && candidate.searchStatus !== searchStatus) return false;
    if (employmentGoal && candidate.employmentGoal !== employmentGoal) return false;
    if (skillIds.some(id => !candidate.skills.some(skill => skill.id === id))) return false;
    if (salaryMin !== null && !(candidate.salaryMaxRub !== null && candidate.salaryMaxRub >= salaryMin)) return false;
    if (salaryMax !== null && !(candidate.salaryMinRub !== null && candidate.salaryMinRub <= salaryMax)) return false;
    if (ageMin !== null && !(candidate.age !== null && candidate.age >= ageMin)) return false;
    if (ageMax !== null && !(candidate.age !== null && candidate.age <= ageMax)) return false;
    if (query) {
      const haystack = [candidate.firstName, candidate.lastName, candidate.profession, candidate.city, candidate.about, ...candidate.skills.map(skill => skill.name)]
        .filter(Boolean).join(" ").normalize("NFKC").toLocaleLowerCase("ru-RU");
      if (!query.split(/\s+/).every(term => haystack.includes(term))) return false;
    }
    return true;
  });

  const [favoriteRows, interestRows, practiceRows] = await Promise.all([
    db.select({ specialistUserId: employerSpecialistFavorites.specialistUserId }).from(employerSpecialistFavorites).where(eq(employerSpecialistFavorites.employerUserId, ownerUserId)),
    db.select({ id: offers.id, specialistUserId: offers.specialistUserId, status: offers.status }).from(offers).where(and(eq(offers.employerUserId, ownerUserId), ne(offers.status, "REJECTED"), ne(offers.status, "WITHDRAWN"))),
    db.select({ candidateUserId: practiceInvitations.candidateUserId, status: practiceInvitations.status }).from(practiceInvitations).where(eq(practiceInvitations.employerUserId, ownerUserId)).orderBy(desc(practiceInvitations.createdAt)),
  ]);
  const favorites = new Set(favoriteRows.map(row => row.specialistUserId));
  const interests = new Map(interestRows.map(row => [row.specialistUserId, row]));
  const activePracticeStatuses = new Set(["SENT", "VIEWED", "ACCEPTED", "INTERVIEW", "HIRED"]);
  const practiceStatuses = new Map<string, string>();
  for (const row of practiceRows) if (activePracticeStatuses.has(row.status) && !practiceStatuses.has(row.candidateUserId)) practiceStatuses.set(row.candidateUserId, row.status);
  const scored = filtered.map(candidate => {
    const searchScore = search
      ? deterministicScorer.score({ ...search, skillIds: search.skillIds }, { ...candidate, skillIds: candidate.skills.map(skill => skill.id) } as CandidateCriteria)
      : query ? Math.min(100, candidate.skills.filter(skill => skill.name.toLocaleLowerCase("ru-RU").includes(query)).length * 15 + 50) : 0;
    return {
      userId: candidate.userId,
      firstName: candidate.firstName,
      lastName: candidate.lastName,
      age: candidate.age,
      city: candidate.city,
      cityId: candidate.cityId,
      profession: candidate.profession,
      professionId: candidate.professionId,
      level: candidate.level,
      experience: candidate.experience,
      skills: candidate.skills.slice(0, 8),
      about: candidate.about,
      salaryMinRub: candidate.salaryMinRub,
      salaryMaxRub: candidate.salaryMaxRub,
      workFormat: candidate.workFormat,
      employmentType: candidate.employmentType,
      employmentGoal: candidate.employmentGoal,
      searchStatus: candidate.searchStatus,
      educationalInstitution: candidate.educationalInstitution,
      educationProgram: candidate.educationProgram,
      studyCourse: candidate.studyCourse,
      practiceStartDate: candidate.practiceStartDate,
      practiceEndDate: candidate.practiceEndDate,
      desiredDirections: candidate.desiredDirections,
      practiceWorkFormats: candidate.practiceWorkFormats,
      avatarFileId: candidate.avatarFileId,
      avatarUrl: `${candidate.avatarUrl}?size=256`,
      matchPercent: searchScore,
      isFavorite: favorites.has(candidate.userId),
      interestStatus: interests.get(candidate.userId)?.status ?? null,
      interestOfferId: interests.get(candidate.userId)?.id ?? null,
      practiceInvitationStatus: practiceStatuses.get(candidate.userId) ?? null,
    };
  }).sort((a, b) => b.matchPercent - a.matchPercent || a.userId.localeCompare(b.userId));
  return paged(scored, page, pageSize);
}
