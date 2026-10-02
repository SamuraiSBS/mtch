import { db } from "@/db/client";
import { companies, companySocialLinks, matches, offers, specialistProfiles, user } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { fail, pageParams, paged } from "@/server/http";
import { parse, offerInput } from "@/server/validation";
import { ownCompany } from "@/server/companies/service";
import { searchDetail } from "@/server/search-profiles/service";
import { specialistDetail } from "@/server/specialists/service";
import { deterministicScorer, type CandidateCriteria } from "@/server/matching/scorer";

export async function createOffer(employerUserId: string, input: unknown) {
  const data = parse(offerInput, input); const company = await ownCompany(employerUserId); const search = await searchDetail(employerUserId, data.searchProfileId);
  const specialist = await specialistDetail(data.specialistUserId);
  if (specialist.employmentGoal === "PRACTICE") fail(409, "PRACTICE_ONLY", "Этому специалисту можно отправить только приглашение на практику");
  if (specialist.searchStatus === "NOT_LOOKING") fail(409, "SPECIALIST_UNAVAILABLE", "Специалист сейчас не ищет предложения");
  const [existingMatch] = await db.select({ id: matches.id }).from(matches).where(and(eq(matches.employerUserId, employerUserId), eq(matches.specialistUserId, data.specialistUserId)));
  if (existingMatch) fail(409, "MATCH_ALREADY_EXISTS", "Match уже существует");
  const [existingOffer] = await db.select({ id: offers.id }).from(offers).where(and(eq(offers.employerUserId, employerUserId), eq(offers.specialistUserId, data.specialistUserId), eq(offers.status, "SENT")));
  if (existingOffer) fail(409, "OFFER_ALREADY_SENT", "Предложение уже отправлено");
  const score = deterministicScorer.score({ ...search, skillIds: search.skillIds }, { ...specialist, skillIds: specialist.skills.map(x => x.id) } as CandidateCriteria);
  try {
    const [created] = await db.insert(offers).values({ ...data, employerUserId, companyId: company.id, searchProfileSnapshot: { version: 1, ...search }, specialistSnapshot: { version: 1, ...specialist }, companyNameSnapshot: company.name, scoreAtSend: score }).returning();
    return created;
  } catch (error) { if ((error as { code?: string }).code === "23505") fail(409, "OFFER_ALREADY_SENT", "Предложение уже отправлено"); throw error; }
}
export async function offerDetail(userId: string, id: string) { const [offer] = await db.select().from(offers).where(eq(offers.id, id)); if (!offer || (offer.employerUserId !== userId && offer.specialistUserId !== userId)) fail(404, "OFFER_NOT_FOUND", "Предложение не найдено"); return offer; }
export async function listOffers(userId: string, side: "incoming" | "outgoing", url: string) { const { page, pageSize } = pageParams(url); const status = new URL(url).searchParams.get("status"); if (status && !z.enum(["SENT", "ACCEPTED", "REJECTED", "WITHDRAWN"]).safeParse(status).success) fail(422, "INVALID_STATUS", "Некорректный статус"); const rows = await db.select().from(offers).where(side === "incoming" ? eq(offers.specialistUserId, userId) : eq(offers.employerUserId, userId)).orderBy(desc(offers.sentAt)); return paged(status ? rows.filter(x => x.status === status) : rows, page, pageSize); }
export async function transitionOffer(userId: string, role: "SPECIALIST" | "EMPLOYER", id: string, action: "accept" | "reject" | "withdraw") {
  const offer = await offerDetail(userId, id);
  if (action === "withdraw" ? (role !== "EMPLOYER" || offer.employerUserId !== userId) : (role !== "SPECIALIST" || offer.specialistUserId !== userId)) fail(403, "FORBIDDEN", "Недостаточно прав");
  const status = { accept: "ACCEPTED", reject: "REJECTED", withdraw: "WITHDRAWN" }[action] as "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  return db.transaction(async tx => {
    const [updated] = await tx.update(offers).set({ status, resolvedAt: new Date() }).where(and(eq(offers.id, id), eq(offers.status, "SENT"))).returning();
    if (!updated) fail(409, "OFFER_INVALID_STATE", "Предложение уже обработано");
    if (action === "accept") {
      const [match] = await tx.insert(matches).values({ offerId: id, employerUserId: offer.employerUserId, specialistUserId: offer.specialistUserId, companyId: offer.companyId }).returning();
      return { offer: updated, match };
    }
    return { offer: updated };
  });
}
export async function listMatches(userId: string, url: string) { const { page, pageSize } = pageParams(url); const rows = await db.select().from(matches).orderBy(desc(matches.acceptedAt)); return paged(rows.filter(x => x.employerUserId === userId || x.specialistUserId === userId), page, pageSize); }
export async function matchDetail(userId: string, id: string) { const [match] = await db.select().from(matches).where(eq(matches.id, id)); if (!match || (match.employerUserId !== userId && match.specialistUserId !== userId)) fail(404, "MATCH_NOT_FOUND", "Match не найден"); return match; }
export async function matchContacts(userId: string, id: string) { const match = await matchDetail(userId, id); if (userId === match.employerUserId) { const [account] = await db.select({ email: user.email }).from(user).where(eq(user.id, match.specialistUserId)); const [profile] = await db.select({ telegram: specialistProfiles.telegram }).from(specialistProfiles).where(eq(specialistProfiles.userId, match.specialistUserId)); return { email: account.email, telegram: profile?.telegram ?? null }; } const [account] = await db.select({ email: user.email }).from(user).where(eq(user.id, match.employerUserId)); const [company] = await db.select().from(companies).where(eq(companies.id, match.companyId)); const socialLinks = await db.select({ platform: companySocialLinks.platform, value: companySocialLinks.value }).from(companySocialLinks).where(eq(companySocialLinks.companyId, match.companyId)); return { email: account.email, contactEmail: company.contactEmail, telegram: company.telegram, phone: company.phone, socialLinks }; }
