import { db } from "@/db/client";
import { companies, companyPhotos, companySocialLinks, mediaFiles, user } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail } from "@/server/http";
import { companyInput, companyPhotoCategories, companySocialPlatforms, parse } from "@/server/validation";

export async function ownCompany(ownerUserId: string) { const [company] = await db.select().from(companies).where(eq(companies.ownerUserId, ownerUserId)); if (!company) fail(404, "COMPANY_NOT_FOUND", "Компания не найдена"); return company; }
export async function companyDetail(id: string, own = false) {
  const [row] = await db.select({ company: companies, ownerEmail: user.email }).from(companies).innerJoin(user, eq(user.id, companies.ownerUserId)).where(eq(companies.id, id));
  if (!row) fail(404, "COMPANY_NOT_FOUND", "Компания не найдена");
  const photos = await db.select({ id: companyPhotos.id, fileId: companyPhotos.fileId, category: companyPhotos.category, sortOrder: companyPhotos.sortOrder }).from(companyPhotos).where(eq(companyPhotos.companyId, id)).orderBy(asc(companyPhotos.category), asc(companyPhotos.sortOrder), asc(companyPhotos.createdAt));
  const { contactEmail, telegram, phone, ...publicCompany } = row.company;
  const base = { ...publicCompany, logoUrl: `/api/v1/media/${row.company.logoFileId}`, photos: photos.map(x => ({ ...x, url: `/api/v1/media/${x.fileId}` })) };
  if (!own) return base;
  const socialLinks = await db.select().from(companySocialLinks).where(eq(companySocialLinks.companyId, id)).orderBy(asc(companySocialLinks.sortOrder), asc(companySocialLinks.createdAt));
  return { ...base, contactEmail, telegram, phone, ownerEmail: row.ownerEmail, socialLinks };
}
export async function saveCompany(ownerUserId: string, input: unknown, create: boolean) {
  const data = parse(companyInput, input);
  const { photos, socialLinks, ...companyData } = data;
  const companyId = await db.transaction(async tx => {
    const [existing] = await tx.select().from(companies).where(eq(companies.ownerUserId, ownerUserId));
    if (create && existing) fail(409, "COMPANY_EXISTS", "Компания уже создана");
    if (!create && !existing) fail(404, "COMPANY_NOT_FOUND", "Компания не найдена");

    const [logo] = await tx.select().from(mediaFiles).where(eq(mediaFiles.id, companyData.logoFileId));
    if (!logo || logo.ownerUserId !== ownerUserId || logo.kind !== "COMPANY_LOGO" || logo.byteSize > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(logo.mimeType)) {
      fail(422, "INVALID_LOGO", "Загрузите логотип компании в формате JPEG, PNG или WebP размером до 5 МБ");
    }

    let savedId: string;
    if (create) {
      const [company] = await tx.insert(companies).values({ ...companyData, ownerUserId }).returning({ id: companies.id });
      savedId = company.id;
    } else {
      savedId = existing.id;
      await tx.update(companies).set({ ...companyData, updatedAt: new Date() }).where(eq(companies.id, savedId));
    }

    if (photos !== undefined) {
      if (photos.length > 20) fail(422, "TOO_MANY_COMPANY_PHOTOS", "Можно добавить не больше 20 фотографий");
      const photoFileIds = photos.map(photo => photo.fileId);
      const files = photoFileIds.length ? await tx.select().from(mediaFiles).where(inArray(mediaFiles.id, photoFileIds)) : [];
      const byId = new Map(files.map(file => [file.id, file]));
      for (const photo of photos) {
        const file = byId.get(photo.fileId);
        if (!file || file.ownerUserId !== ownerUserId || file.kind !== "COMPANY_PHOTO" || file.byteSize > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.mimeType)) {
          fail(422, "INVALID_PHOTO", "Одно из фото недоступно или имеет неподдерживаемый формат");
        }
      }
      if (photoFileIds.length) {
        const inUse = await tx.select({ companyId: companyPhotos.companyId, fileId: companyPhotos.fileId }).from(companyPhotos).where(inArray(companyPhotos.fileId, photoFileIds));
        if (inUse.some(photo => photo.companyId !== savedId)) fail(422, "INVALID_PHOTO", "Одно из фото уже прикреплено к другой компании");
      }
      await tx.delete(companyPhotos).where(eq(companyPhotos.companyId, savedId));
      if (photos.length) await tx.insert(companyPhotos).values(photos.map(photo => ({ companyId: savedId, fileId: photo.fileId, category: photo.category, sortOrder: photo.sortOrder })));
    }

    if (socialLinks !== undefined) {
      await tx.delete(companySocialLinks).where(eq(companySocialLinks.companyId, savedId));
      if (socialLinks.length) await tx.insert(companySocialLinks).values(socialLinks.map((link, sortOrder) => ({ ...link, companyId: savedId, sortOrder })));
    }
    return savedId;
  });
  return companyDetail(companyId, true);
}
export async function addCompanyPhoto(ownerUserId: string, input: unknown) {
  const { fileId, category } = parse(z.object({ fileId: z.uuid(), category: z.enum(companyPhotoCategories).optional() }), input);
  const company = await ownCompany(ownerUserId);
  const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, fileId));
  if (!file || file.ownerUserId !== ownerUserId || file.kind !== "COMPANY_PHOTO" || file.byteSize > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.mimeType)) fail(422, "INVALID_PHOTO", "Недоступное фото");
  return db.transaction(async tx => {
    const [locked] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.id, company.id)).for("update");
    if (!locked) fail(404, "COMPANY_NOT_FOUND", "Компания не найдена");
    const [alreadyAdded] = await tx.select({ id: companyPhotos.id }).from(companyPhotos).where(eq(companyPhotos.fileId, fileId));
    if (alreadyAdded) fail(409, "PHOTO_ALREADY_ADDED", "Это фото уже прикреплено к компании");
    const current = await tx.select({ sortOrder: companyPhotos.sortOrder, category: companyPhotos.category }).from(companyPhotos).where(eq(companyPhotos.companyId, company.id));
    if (current.length >= 20) fail(422, "TOO_MANY_COMPANY_PHOTOS", "Можно добавить не больше 20 фотографий");
    const targetCategory = category ?? "OTHER";
    const nextOrder = current.filter(photo => photo.category === targetCategory).reduce((max, photo) => Math.max(max, photo.sortOrder), -1) + 1;
    const [photo] = await tx.insert(companyPhotos).values({ companyId: company.id, fileId, category: targetCategory, sortOrder: nextOrder }).returning();
    return { ...photo, url: `/api/v1/media/${fileId}` };
  });
}
export async function removeCompanyPhoto(ownerUserId: string, photoId: string) { const company = await ownCompany(ownerUserId); const rows = await db.delete(companyPhotos).where(and(eq(companyPhotos.id, photoId), eq(companyPhotos.companyId, company.id))).returning(); if (!rows.length) fail(404, "PHOTO_NOT_FOUND", "Фото не найдено"); }
export async function addSocialLink(ownerUserId: string, input: unknown) {
  const { platform, value } = parse(z.object({ platform: z.enum(companySocialPlatforms), value: z.string().trim().min(1).max(500) }), input);
  const company = await ownCompany(ownerUserId);
  const normalized = value.normalize("NFKC").toLocaleLowerCase("ru-RU");
  return db.transaction(async tx => {
    const [locked] = await tx.select({ id: companies.id }).from(companies).where(eq(companies.id, company.id)).for("update");
    if (!locked) fail(404, "COMPANY_NOT_FOUND", "Компания не найдена");
    const links = await tx.select({ platform: companySocialLinks.platform, value: companySocialLinks.value, sortOrder: companySocialLinks.sortOrder }).from(companySocialLinks).where(eq(companySocialLinks.companyId, company.id));
    if (links.some(link => link.platform === platform && link.value.normalize("NFKC").toLocaleLowerCase("ru-RU") === normalized)) fail(409, "DUPLICATE_SOCIAL_LINK", "Эта запись уже добавлена");
    const sortOrder = links.reduce((max, link) => Math.max(max, link.sortOrder), -1) + 1;
    const [link] = await tx.insert(companySocialLinks).values({ companyId: company.id, platform, value, sortOrder }).returning();
    return link;
  }).catch(error => {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505") fail(409, "DUPLICATE_SOCIAL_LINK", "Эта запись уже добавлена");
    throw error;
  });
}
export async function removeSocialLink(ownerUserId: string, linkId: string) { const company = await ownCompany(ownerUserId); const rows = await db.delete(companySocialLinks).where(and(eq(companySocialLinks.id, linkId), eq(companySocialLinks.companyId, company.id))).returning(); if (!rows.length) fail(404, "SOCIAL_LINK_NOT_FOUND", "Ссылка не найдена"); }
