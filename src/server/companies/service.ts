import { db } from "@/db/client";
import { companies, companyPhotos, companySocialLinks, mediaFiles, user } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail } from "@/server/http";
import { companyInput, parse } from "@/server/validation";

export async function ownCompany(ownerUserId: string) { const [company] = await db.select().from(companies).where(eq(companies.ownerUserId, ownerUserId)); if (!company) fail(404, "COMPANY_NOT_FOUND", "Компания не найдена"); return company; }
export async function companyDetail(id: string, own = false) {
  const [row] = await db.select({ company: companies, ownerEmail: user.email }).from(companies).innerJoin(user, eq(user.id, companies.ownerUserId)).where(eq(companies.id, id));
  if (!row) fail(404, "COMPANY_NOT_FOUND", "Компания не найдена");
  const photos = await db.select({ id: companyPhotos.id, fileId: companyPhotos.fileId }).from(companyPhotos).where(eq(companyPhotos.companyId, id));
  const { contactEmail, telegram, phone, ...publicCompany } = row.company;
  const base = { ...publicCompany, logoUrl: `/api/v1/media/${row.company.logoFileId}`, photos: photos.map(x => ({ ...x, url: `/api/v1/media/${x.fileId}` })) };
  if (!own) return base;
  const socialLinks = await db.select().from(companySocialLinks).where(eq(companySocialLinks.companyId, id));
  return { ...base, contactEmail, telegram, phone, ownerEmail: row.ownerEmail, socialLinks };
}
export async function saveCompany(ownerUserId: string, input: unknown, create: boolean) {
  const data = parse(companyInput, input);
  const [logo] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, data.logoFileId));
  if (!logo || logo.ownerUserId !== ownerUserId || logo.kind !== "COMPANY_LOGO") fail(422, "INVALID_LOGO", "Загрузите логотип компании");
  const [existing] = await db.select().from(companies).where(eq(companies.ownerUserId, ownerUserId));
  if (create && existing) fail(409, "COMPANY_EXISTS", "Компания уже создана"); if (!create && !existing) fail(404, "COMPANY_NOT_FOUND", "Компания не найдена");
  if (create) { const [company] = await db.insert(companies).values({ ...data, ownerUserId }).returning(); return companyDetail(company.id, true); }
  await db.update(companies).set({ ...data, updatedAt: new Date() }).where(eq(companies.ownerUserId, ownerUserId));
  return companyDetail(existing.id, true);
}
export async function addCompanyPhoto(ownerUserId: string, input: unknown) { const { fileId } = parse(z.object({ fileId: z.uuid() }), input); const company = await ownCompany(ownerUserId); const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, fileId)); if (!file || file.ownerUserId !== ownerUserId || file.kind !== "COMPANY_PHOTO") fail(422, "INVALID_PHOTO", "Недоступное фото"); const [photo] = await db.insert(companyPhotos).values({ companyId: company.id, fileId }).returning(); return { ...photo, url: `/api/v1/media/${fileId}` }; }
export async function removeCompanyPhoto(ownerUserId: string, photoId: string) { const company = await ownCompany(ownerUserId); const rows = await db.delete(companyPhotos).where(and(eq(companyPhotos.id, photoId), eq(companyPhotos.companyId, company.id))).returning(); if (!rows.length) fail(404, "PHOTO_NOT_FOUND", "Фото не найдено"); }
export async function addSocialLink(ownerUserId: string, input: unknown) { const { platform, value } = parse(z.object({ platform: z.enum(["TELEGRAM", "INSTAGRAM", "TIKTOK", "OTHER"]), value: z.string().trim().min(1).max(500) }), input); const company = await ownCompany(ownerUserId); const [link] = await db.insert(companySocialLinks).values({ companyId: company.id, platform, value }).returning(); return link; }
export async function removeSocialLink(ownerUserId: string, linkId: string) { const company = await ownCompany(ownerUserId); const rows = await db.delete(companySocialLinks).where(and(eq(companySocialLinks.id, linkId), eq(companySocialLinks.companyId, company.id))).returning(); if (!rows.length) fail(404, "SOCIAL_LINK_NOT_FOUND", "Ссылка не найдена"); }
