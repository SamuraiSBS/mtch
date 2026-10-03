import { db } from "@/db/client";
import { mediaFiles, specialistProfiles, specialistSkills, skills, professions, cities, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fail } from "@/server/http";
import { specialistInput, parse } from "@/server/validation";
import { requireCatalogId, requireSkills, resolveOrCreateCity, resolveOrCreateSkills } from "@/server/catalogs/service";
import { deleteUnusedMedia } from "@/server/storage/media";

export async function specialistDetail(userId: string, own = false, employerView = false) {
  const [row] = await db.select({ profile: specialistProfiles, profession: professions.name, city: cities.name, email: user.email }).from(specialistProfiles).innerJoin(professions, eq(professions.id, specialistProfiles.professionId)).leftJoin(cities, eq(cities.id, specialistProfiles.cityId)).innerJoin(user, eq(user.id, specialistProfiles.userId)).where(eq(specialistProfiles.userId, userId));
  if (!row) fail(404, "SPECIALIST_NOT_FOUND", "Профиль не найден");
  const chosenSkills = await db.select({ id: skills.id, name: skills.name }).from(specialistSkills).innerJoin(skills, eq(skills.id, specialistSkills.skillId)).where(eq(specialistSkills.specialistUserId, userId));
  const { telegram, birthDate, resumeFileId, ...publicProfile } = row.profile;
  const calculatedAge = birthDate ? Math.max(0, new Date().getFullYear() - new Date(birthDate).getFullYear() - (new Date().toISOString().slice(5, 10) < birthDate.slice(5, 10) ? 1 : 0)) : null;
  return { ...publicProfile, profession: row.profession, city: row.city, age: row.profile.age ?? calculatedAge, skills: chosenSkills, avatarUrl: `/api/v1/media/${row.profile.avatarFileId}`, resume: resumeFileId ? "ATTACHED" : null, ...((own || employerView) ? { telegram } : {}), ...(own ? { birthDate, resumeFileId, email: row.email } : {}) };
}
export async function saveSpecialist(userId: string, input: unknown, create: boolean) {
  const data = parse(specialistInput, input);
  await requireCatalogId("professions", data.professionId);
  const cityId = data.cityId ?? (data.cityName ? await resolveOrCreateCity(data.cityName) : null);
  if (cityId) await requireCatalogId("cities", cityId);
  const customSkillIds = await resolveOrCreateSkills(data.customSkills);
  const skillIds = [...new Set([...data.skillIds, ...customSkillIds])];
  await requireSkills(skillIds);
  const [avatar] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, data.avatarFileId));
  if (!avatar || avatar.ownerUserId !== userId || avatar.kind !== "AVATAR") fail(422, "INVALID_AVATAR", "Загрузите свой аватар");
  const [exists] = await db.select({ id: specialistProfiles.userId, avatarFileId: specialistProfiles.avatarFileId, resumeFileId: specialistProfiles.resumeFileId }).from(specialistProfiles).where(eq(specialistProfiles.userId, userId));
  if (data.resumeFileId) {
    const [resume] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, data.resumeFileId));
    if (!resume || resume.ownerUserId !== userId || resume.kind !== "RESUME") fail(422, "INVALID_RESUME", "Загрузите свой PDF-файл");
  }
  if (create && exists) fail(409, "PROFILE_EXISTS", "Профиль уже создан"); if (!create && !exists) fail(404, "PROFILE_NOT_FOUND", "Профиль не найден");
  const { skillIds: _skillIds, customSkills: _customSkills, cityName: _cityName, ...fields } = data;
  const practice = fields.employmentGoal === "PRACTICE";
  const values = { ...fields, birthDate: fields.birthDate ?? null, age: fields.age ?? null, resumeFileId: fields.resumeFileId ?? null, cityId,
    educationalInstitution: practice ? fields.educationalInstitution! : null, educationProgram: practice ? fields.educationProgram! : null,
    studyCourse: practice ? fields.studyCourse! : null, practiceStartDate: practice ? fields.practiceStartDate! : null, practiceEndDate: practice ? fields.practiceEndDate! : null,
    desiredDirections: practice ? fields.desiredDirections! : null, practiceWorkFormats: practice ? fields.practiceWorkFormats! : null };
  await db.transaction(async tx => {
    if (create) await tx.insert(specialistProfiles).values({ ...values, userId });
    else await tx.update(specialistProfiles).set({ ...values, updatedAt: new Date() }).where(eq(specialistProfiles.userId, userId));
    await tx.delete(specialistSkills).where(eq(specialistSkills.specialistUserId, userId));
    await tx.insert(specialistSkills).values(skillIds.map(skillId => ({ specialistUserId: userId, skillId })));
  });
  if (exists && exists.avatarFileId !== data.avatarFileId) {
    try { await deleteUnusedMedia(userId, exists.avatarFileId); }
    catch (error) { console.error("old avatar cleanup failed", { userId, fileId: exists.avatarFileId, error }); }
  }
  if (exists?.resumeFileId && exists.resumeFileId !== data.resumeFileId) {
    try { await deleteUnusedMedia(userId, exists.resumeFileId); }
    catch (error) { console.error("old resume cleanup failed", { userId, fileId: exists.resumeFileId, error }); }
  }
  return specialistDetail(userId, true);
}
