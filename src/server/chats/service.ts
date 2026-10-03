import { db } from "@/db/client";
import { cities, companies, matchMessages, matches, offers, professions, specialistFavorites, specialistProfiles } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { matchDetail } from "@/server/offers/service";
import { parse } from "@/server/validation";
import { z } from "zod";

export async function listChatThreads(userId: string, role: "SPECIALIST" | "EMPLOYER") {
  const rows = await db.select({
    id: matches.id,
    offerId: matches.offerId,
    companyId: companies.id,
    companyName: companies.name,
    companyLogoFileId: companies.logoFileId,
    specialistFirstName: specialistProfiles.firstName,
    specialistLastName: specialistProfiles.lastName,
    specialistAvatarFileId: specialistProfiles.avatarFileId,
    profession: professions.name,
    city: cities.name,
    acceptedAt: matches.acceptedAt,
  }).from(matches)
    .innerJoin(companies, eq(companies.id, matches.companyId))
    .innerJoin(specialistProfiles, eq(specialistProfiles.userId, matches.specialistUserId))
    .innerJoin(professions, eq(professions.id, specialistProfiles.professionId))
    .leftJoin(cities, eq(cities.id, specialistProfiles.cityId))
    .where(eq(role === "SPECIALIST" ? matches.specialistUserId : matches.employerUserId, userId))
    .orderBy(desc(matches.acceptedAt));
  const favoriteRows = role === "SPECIALIST"
    ? await db.select({ companyId: specialistFavorites.companyId }).from(specialistFavorites).where(eq(specialistFavorites.specialistUserId, userId))
    : [];
  const favorites = new Set(favoriteRows.map((row) => row.companyId));
  const activeItems = await Promise.all(rows.map(async (row) => {
    const [lastMessage] = await db.select({
      body: matchMessages.body,
      senderUserId: matchMessages.senderUserId,
      createdAt: matchMessages.createdAt,
    }).from(matchMessages).where(eq(matchMessages.matchId, row.id)).orderBy(desc(matchMessages.createdAt)).limit(1);
    return {
      id: row.id,
      offerId: row.offerId,
      companyId: row.companyId,
      name: role === "SPECIALIST" ? row.companyName : `${row.specialistFirstName} ${row.specialistLastName}`,
      subtitle: role === "SPECIALIST" ? row.profession : [row.profession, row.city].filter(Boolean).join(" · "),
      avatarFileId: role === "SPECIALIST" ? row.companyLogoFileId : row.specialistAvatarFileId,
      isFavorite: role === "SPECIALIST" && favorites.has(row.companyId),
      status: "ACTIVE" as const,
      acceptedAt: row.acceptedAt,
      lastMessage: lastMessage ?? null,
    };
  }));

  const waitingItems = role === "EMPLOYER" ? await db.select({
    id: offers.id,
    companyId: offers.companyId,
    positionTitle: offers.positionTitle,
    sentAt: offers.sentAt,
    firstName: specialistProfiles.firstName,
    lastName: specialistProfiles.lastName,
    avatarFileId: specialistProfiles.avatarFileId,
    profession: professions.name,
    city: cities.name,
  }).from(offers)
    .innerJoin(specialistProfiles, eq(specialistProfiles.userId, offers.specialistUserId))
    .innerJoin(professions, eq(professions.id, specialistProfiles.professionId))
    .leftJoin(cities, eq(cities.id, specialistProfiles.cityId))
    .where(and(eq(offers.employerUserId, userId), eq(offers.status, "SENT")))
    .orderBy(desc(offers.sentAt)) : [];
  const waiting = waitingItems.map(row => ({
    id: row.id,
    offerId: row.id,
    companyId: row.companyId,
    name: `${row.firstName} ${row.lastName}`,
    subtitle: [row.profession, row.city].filter(Boolean).join(" · "),
    avatarFileId: row.avatarFileId,
    isFavorite: false,
    status: "WAITING" as const,
    acceptedAt: row.sentAt,
    lastMessage: null,
    positionTitle: row.positionTitle,
  }));

  const items = [...activeItems, ...waiting];
  return { items: items.sort((left, right) => (right.lastMessage?.createdAt ?? right.acceptedAt).getTime() - (left.lastMessage?.createdAt ?? left.acceptedAt).getTime()) };
}

export async function listChatMessages(userId: string, matchId: string) {
  await matchDetail(userId, matchId);
  const rows = await db.select().from(matchMessages)
    .where(eq(matchMessages.matchId, matchId))
    .orderBy(desc(matchMessages.createdAt))
    .limit(200);
  return { items: rows.reverse() };
}

export async function createChatMessage(userId: string, matchId: string, input: unknown) {
  await matchDetail(userId, matchId);
  const data = parse(z.object({ body: z.string().trim().min(1).max(3000) }), input);
  const [message] = await db.insert(matchMessages).values({ matchId, senderUserId: userId, body: data.body }).returning();
  return message;
}
