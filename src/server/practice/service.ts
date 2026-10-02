import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { cities, companies, companySocialLinks, practiceInvitations, practiceRecruitments, specialistProfiles, specialistSkills, user } from "@/db/schema";
import { ownCompany } from "@/server/companies/service";
import { requireCatalogId, requireSkills } from "@/server/catalogs/service";
import { fail, pageParams, paged } from "@/server/http";
import { specialistDetail } from "@/server/specialists/service";
import { parse, practiceRecruitmentInput, directions, workFormats } from "@/server/validation";
import { practiceScore } from "./scorer";

export async function ownPracticeRecruitment(employerUserId: string, id: string) {
  const company = await ownCompany(employerUserId);
  const [row] = await db.select().from(practiceRecruitments).where(and(eq(practiceRecruitments.id, id), eq(practiceRecruitments.companyId, company.id)));
  if (!row) fail(404, "PRACTICE_RECRUITMENT_NOT_FOUND", "Набор не найден");
  return row;
}

async function recruitmentStats(id: string) {
  const invitations = await db.select().from(practiceInvitations).where(eq(practiceInvitations.practiceRecruitmentId, id));
  return { invited: invitations.length, accepted: invitations.filter(x => ["ACCEPTED", "INTERVIEW", "HIRED"].includes(x.status)).length,
    hired: invitations.filter(x => x.status === "HIRED").length, newResponses: invitations.filter(x => x.respondedAt && x.status !== "DECLINED").length };
}

export async function practiceRecruitmentDetail(employerUserId: string, id: string) { const row = await ownPracticeRecruitment(employerUserId, id); const stats = await recruitmentStats(id); return { ...row, slotsFilled: stats.hired, remaining: Math.max(0, row.slotsTotal - stats.hired), stats }; }
export async function listPracticeRecruitments(employerUserId: string, url: string) { const company = await ownCompany(employerUserId); const { page, pageSize } = pageParams(url); const rows = await db.select().from(practiceRecruitments).where(eq(practiceRecruitments.companyId, company.id)).orderBy(desc(practiceRecruitments.createdAt)); return paged(await Promise.all(rows.map(row => practiceRecruitmentDetail(employerUserId, row.id))), page, pageSize); }

export async function savePracticeRecruitment(employerUserId: string, id: string | null, input: unknown) {
  const data = parse(practiceRecruitmentInput, input);
  const company = await ownCompany(employerUserId);
  if (data.cityId) await requireCatalogId("cities", data.cityId);
  await requireSkills([...data.requiredSkillIds, ...data.optionalSkillIds]);
  if (id) {
    const existing = await ownPracticeRecruitment(employerUserId, id);
    if (existing.status === "ARCHIVED" || existing.status === "COMPLETED") fail(409, "PRACTICE_RECRUITMENT_CLOSED", "Закрытый набор нельзя изменить");
    const stats = await recruitmentStats(id);
    if (stats.invited > 0) fail(409, "PRACTICE_RECRUITMENT_LOCKED", "Условия набора нельзя менять после первого приглашения");
    await db.update(practiceRecruitments).set({ ...data, updatedAt: new Date() }).where(eq(practiceRecruitments.id, id));
    return practiceRecruitmentDetail(employerUserId, id);
  }
  const [created] = await db.insert(practiceRecruitments).values({ ...data, employerUserId, companyId: company.id }).returning();
  return practiceRecruitmentDetail(employerUserId, created.id);
}

export async function changePracticeRecruitmentStatus(employerUserId: string, id: string, status: unknown) {
  const next = parse(z.enum(["ACTIVE", "ARCHIVED"]), status);
  const row = await ownPracticeRecruitment(employerUserId, id);
  if (next === "ACTIVE" && row.status !== "DRAFT" || next === "ARCHIVED" && row.status === "ARCHIVED") fail(409, "PRACTICE_INVALID_STATE", "Недопустимый переход статуса");
  await db.update(practiceRecruitments).set({ status: next, updatedAt: new Date() }).where(eq(practiceRecruitments.id, id));
  return practiceRecruitmentDetail(employerUserId, id);
}

export async function practiceMatches(employerUserId: string, id: string, url: string) {
  const recruitment = await ownPracticeRecruitment(employerUserId, id);
  const { page, pageSize } = pageParams(url); const params = new URL(url).searchParams;
  const direction = params.get("direction"); if (direction && !directions.includes(direction as typeof directions[number])) fail(422, "INVALID_FILTER", "Некорректное направление");
  const format = params.get("workFormat"); if (format && !workFormats.includes(format as typeof workFormats[number])) fail(422, "INVALID_FILTER", "Некорректный формат");
  const cityId = params.get("cityId"); if (cityId && !z.uuid().safeParse(cityId).success) fail(422, "INVALID_FILTER", "Некорректный город");
  const course = params.get("studyCourse"); if (course && (!Number.isInteger(Number(course)) || Number(course) < 1 || Number(course) > 6)) fail(422, "INVALID_FILTER", "Некорректный курс");
  const from = params.get("dateFrom"), to = params.get("dateTo"); for (const date of [from, to]) if (date && !z.iso.date().safeParse(date).success) fail(422, "INVALID_FILTER", "Некорректная дата");
  if (from && to && from > to) fail(422, "INVALID_FILTER", "Некорректный период");
  const skillIds = params.getAll("skillId"); for (const skillId of skillIds) if (!z.uuid().safeParse(skillId).success) fail(422, "INVALID_FILTER", "Некорректный навык");
  const verified = params.get("hasVerifiedAchievements"); if (verified === "true") fail(422, "FSP_UNAVAILABLE", "Фильтр подтверждённых достижений будет доступен после подключения ФСП"); if (verified && verified !== "false") fail(422, "INVALID_FILTER", "Некорректный фильтр достижений");
  const rows = await db.select().from(specialistProfiles).where(and(eq(specialistProfiles.employmentGoal, "PRACTICE"), ne(specialistProfiles.searchStatus, "NOT_LOOKING")));
  const results = await Promise.all(rows.map(async candidate => {
    const chosen = await db.select({ skillId: specialistSkills.skillId }).from(specialistSkills).where(eq(specialistSkills.specialistUserId, candidate.userId));
    const match = practiceScore(recruitment, { ...candidate, skillIds: chosen.map(x => x.skillId) });
    if (!match || direction && !candidate.desiredDirections?.includes(direction) || format && !candidate.practiceWorkFormats?.includes(format) || cityId && candidate.cityId !== cityId || course && candidate.studyCourse !== Number(course) || from && candidate.practiceEndDate! < from || to && candidate.practiceStartDate! > to || skillIds.some(skillId => !chosen.some(x => x.skillId === skillId))) return null;
    const detail = await specialistDetail(candidate.userId);
    return { candidate: detail, score: match.score, reasons: match.reasons };
  }));
  const sorted = results.filter(x => x !== null).sort((a, b) => b.score - a.score || a.candidate.userId.localeCompare(b.candidate.userId));
  return paged(sorted, page, pageSize);
}

export async function createPracticeInvitation(employerUserId: string, recruitmentId: string, input: unknown) {
  const data = parse(z.object({ candidateUserId: z.string().uuid(), message: z.string().trim().min(1).max(3000) }), input);
  const recruitment = await ownPracticeRecruitment(employerUserId, recruitmentId);
  if (recruitment.status !== "ACTIVE") fail(409, "PRACTICE_RECRUITMENT_CLOSED", "Набор не активен");
  const [candidate] = await db.select().from(specialistProfiles).where(eq(specialistProfiles.userId, data.candidateUserId));
  if (!candidate) fail(404, "SPECIALIST_NOT_FOUND", "Профиль не найден");
  const chosen = await db.select({ skillId: specialistSkills.skillId }).from(specialistSkills).where(eq(specialistSkills.specialistUserId, candidate.userId));
  const match = practiceScore(recruitment, { ...candidate, skillIds: chosen.map(x => x.skillId) });
  if (!match) fail(409, "PRACTICE_CANDIDATE_INELIGIBLE", "Профиль не подходит под набор");
  const scoreAtSend = match!.score;
  try {
    return await db.transaction(async tx => {
      await tx.execute(sql`select id from practice_recruitments where id = ${recruitmentId} for update`);
      const [current] = await tx.select().from(practiceRecruitments).where(eq(practiceRecruitments.id, recruitmentId));
      const hired = await tx.select({ id: practiceInvitations.id }).from(practiceInvitations).where(and(eq(practiceInvitations.practiceRecruitmentId, recruitmentId), eq(practiceInvitations.status, "HIRED")));
      if (current.status !== "ACTIVE" || hired.length >= current.slotsTotal) fail(409, "PRACTICE_RECRUITMENT_CLOSED", "Места закончились");
      const [created] = await tx.insert(practiceInvitations).values({ practiceRecruitmentId: recruitmentId, employerUserId, candidateUserId: data.candidateUserId, message: data.message, scoreAtSend }).returning();
      return created;
    });
  } catch (error) { if ((error as { code?: string }).code === "23505") fail(409, "PRACTICE_INVITATION_EXISTS", "Приглашение уже отправлено"); throw error; }
}

export async function practiceInvitationDetail(userId: string, id: string) {
  const [row] = await db.select().from(practiceInvitations).where(eq(practiceInvitations.id, id));
  if (!row || row.employerUserId !== userId && row.candidateUserId !== userId) fail(404, "PRACTICE_INVITATION_NOT_FOUND", "Приглашение не найдено");
  const [recruitment] = await db.select().from(practiceRecruitments).where(eq(practiceRecruitments.id, row.practiceRecruitmentId));
  const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, recruitment.companyId));
  const [city] = recruitment.cityId ? await db.select({ name: cities.name }).from(cities).where(eq(cities.id, recruitment.cityId)) : [];
  const [candidate] = await db.select({ firstName: specialistProfiles.firstName, lastName: specialistProfiles.lastName }).from(specialistProfiles).where(eq(specialistProfiles.userId, row.candidateUserId));
  return { ...row, candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : "Специалист", recruitment: { title: recruitment.title, description: recruitment.description, direction: recruitment.direction, practiceStartDate: recruitment.practiceStartDate, practiceEndDate: recruitment.practiceEndDate, workFormats: recruitment.workFormats, cityId: recruitment.cityId, cityName: city?.name ?? null, officialPracticeSupport: recruitment.officialPracticeSupport }, companyName: company.name };
}
export async function listPracticeInvitations(userId: string, role: "SPECIALIST" | "EMPLOYER", url: string, recruitmentId?: string) {
  const { page, pageSize } = pageParams(url);
  if (recruitmentId) await ownPracticeRecruitment(userId, recruitmentId);
  const rows = await db.select().from(practiceInvitations).where(recruitmentId ? eq(practiceInvitations.practiceRecruitmentId, recruitmentId) : role === "SPECIALIST" ? eq(practiceInvitations.candidateUserId, userId) : eq(practiceInvitations.employerUserId, userId)).orderBy(desc(practiceInvitations.createdAt));
  return paged(await Promise.all(rows.map(x => practiceInvitationDetail(userId, x.id))), page, pageSize);
}

export async function transitionPracticeInvitation(userId: string, role: "SPECIALIST" | "EMPLOYER", id: string, action: "view" | "accept" | "decline" | "interview" | "hired") {
  const invitation = await practiceInvitationDetail(userId, id);
  const studentAction = ["view", "accept", "decline"].includes(action);
  if (studentAction ? role !== "SPECIALIST" || invitation.candidateUserId !== userId : role !== "EMPLOYER" || invitation.employerUserId !== userId) fail(403, "FORBIDDEN", "Недостаточно прав");
  return db.transaction(async tx => {
    await tx.execute(sql`select id from practice_recruitments where id = ${invitation.practiceRecruitmentId} for update`);
    const [current] = await tx.select().from(practiceInvitations).where(eq(practiceInvitations.id, id));
    const allowed = action === "view" ? current.status === "SENT" : action === "accept" || action === "decline" ? ["SENT", "VIEWED"].includes(current.status) : action === "interview" ? current.status === "ACCEPTED" : current.status === "INTERVIEW";
    if (!allowed) fail(409, "PRACTICE_INVALID_STATE", "Приглашение уже обработано");
    const status = { view: "VIEWED", accept: "ACCEPTED", decline: "DECLINED", interview: "INTERVIEW", hired: "HIRED" } as const;
    if (action === "hired") {
      const [recruitment] = await tx.select().from(practiceRecruitments).where(eq(practiceRecruitments.id, invitation.practiceRecruitmentId));
      const hired = await tx.select({ id: practiceInvitations.id }).from(practiceInvitations).where(and(eq(practiceInvitations.practiceRecruitmentId, invitation.practiceRecruitmentId), eq(practiceInvitations.status, "HIRED")));
      if (recruitment.status !== "ACTIVE" || hired.length >= recruitment.slotsTotal) fail(409, "PRACTICE_RECRUITMENT_FULL", "Места закончились");
    }
    const now = new Date();
    const [updated] = await tx.update(practiceInvitations).set({ status: status[action], updatedAt: now, ...(action === "view" ? { viewedAt: now } : {}), ...(action === "accept" || action === "decline" ? { respondedAt: now } : {}) }).where(eq(practiceInvitations.id, id)).returning();
    if (action === "hired") {
      const [recruitment] = await tx.select().from(practiceRecruitments).where(eq(practiceRecruitments.id, invitation.practiceRecruitmentId));
      const hired = await tx.select({ id: practiceInvitations.id }).from(practiceInvitations).where(and(eq(practiceInvitations.practiceRecruitmentId, invitation.practiceRecruitmentId), eq(practiceInvitations.status, "HIRED")));
      if (hired.length >= recruitment.slotsTotal) await tx.update(practiceRecruitments).set({ status: "COMPLETED", updatedAt: now }).where(eq(practiceRecruitments.id, recruitment.id));
    }
    return updated;
  });
}

export async function practiceContacts(userId: string, role: "SPECIALIST" | "EMPLOYER", id: string) {
  const invitation = await practiceInvitationDetail(userId, id);
  if (!["ACCEPTED", "INTERVIEW", "HIRED"].includes(invitation.status)) fail(403, "CONTACTS_LOCKED", "Контакты доступны после принятия приглашения");
  if (role === "EMPLOYER") {
    const [account] = await db.select({ email: user.email }).from(user).where(eq(user.id, invitation.candidateUserId));
    const [profile] = await db.select({ telegram: specialistProfiles.telegram }).from(specialistProfiles).where(eq(specialistProfiles.userId, invitation.candidateUserId));
    return { email: account.email, telegram: profile?.telegram ?? null };
  }
  const [account] = await db.select({ email: user.email }).from(user).where(eq(user.id, invitation.employerUserId));
  const [company] = await db.select({ id: companies.id, contactEmail: companies.contactEmail, telegram: companies.telegram, phone: companies.phone }).from(companies).where(eq(companies.ownerUserId, invitation.employerUserId));
  const socialLinks = company ? await db.select({ platform: companySocialLinks.platform, value: companySocialLinks.value }).from(companySocialLinks).where(eq(companySocialLinks.companyId, company.id)).orderBy(asc(companySocialLinks.sortOrder), asc(companySocialLinks.createdAt)) : [];
  return { email: account.email, contactEmail: company?.contactEmail ?? null, telegram: company?.telegram ?? null, phone: company?.phone ?? null, socialLinks };
}
