import { db } from "@/db/client";
import { avatarAssets, companies, companyPhotos, mediaFiles, specialistProfiles } from "@/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { fail } from "@/server/http";
import { processAvatar } from "./avatar-processor";
import { localFileStorage } from "./local";

function detectedMime(bytes: Uint8Array) {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a) return "image/png";
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

async function saveAvatar(userId: string, original: Uint8Array, originalMimeType: string) {
  const versions = await processAvatar(original);
  const keys: string[] = [];
  try {
    for (const data of [original, versions.large, versions.medium, versions.small]) keys.push(await localFileStorage.save(data));
    const fileId = await db.transaction(async tx => {
      const [record] = await tx.insert(mediaFiles).values({ ownerUserId: userId, kind: "AVATAR", storageKey: keys[1], mimeType: "image/webp", byteSize: versions.large.length }).returning();
      await tx.insert(avatarAssets).values({ fileId: record.id, originalStorageKey: keys[0], mediumStorageKey: keys[2], smallStorageKey: keys[3], originalMimeType });
      return record.id;
    });
    return { fileId };
  } catch (error) {
    await Promise.allSettled(keys.map(key => localFileStorage.remove(key)));
    throw error;
  }
}

export async function uploadMedia(userId: string, role: "SPECIALIST" | "EMPLOYER", form: FormData) {
  const kind = form.get("kind"), file = form.get("file");
  if (kind !== "AVATAR" && kind !== "COMPANY_LOGO" && kind !== "COMPANY_PHOTO" && kind !== "RESUME") return fail(422, "INVALID_MEDIA_KIND", "Некорректный тип файла");
  if (role === "SPECIALIST" ? kind !== "AVATAR" && kind !== "RESUME" : kind === "AVATAR" || kind === "RESUME") return fail(403, "FORBIDDEN", "Недоступный тип файла");
  if (!(file instanceof File)) return fail(422, "FILE_REQUIRED", "Выберите файл");
  const maxSize = kind === "RESUME" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) return fail(413, "FILE_TOO_LARGE", kind === "RESUME" ? "Резюме больше 10 МБ" : "Файл больше 5 МБ");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === "RESUME") {
    const isPdf = bytes.length > 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
    if (!isPdf || file.type !== "application/pdf") return fail(415, "UNSUPPORTED_MEDIA", "Загрузите файл в формате PDF");
    try { await cleanupStagedResumes(); }
    catch (error) { console.error("resume cleanup failed", error); }
    const storageKey = await localFileStorage.save(bytes);
    try {
      const [record] = await db.insert(mediaFiles).values({ ownerUserId: userId, kind, storageKey, mimeType: "application/pdf", byteSize: bytes.length }).returning();
      return { fileId: record.id };
    } catch (error) { await localFileStorage.remove(storageKey); throw error; }
  }
  const mime = detectedMime(bytes);
  if (!mime || mime !== file.type) return fail(415, "UNSUPPORTED_MEDIA", "Допускаются PNG, JPEG и WebP");
  if (kind === "AVATAR") {
    try { await cleanupStagedAvatars(); }
    catch (error) { console.error("avatar cleanup failed", error); }
    return saveAvatar(userId, bytes, mime);
  }
  const storageKey = await localFileStorage.save(bytes);
  try {
    const [record] = await db.insert(mediaFiles).values({ ownerUserId: userId, kind, storageKey, mimeType: mime, byteSize: bytes.length }).returning();
    return { fileId: record.id };
  } catch (error) { await localFileStorage.remove(storageKey); throw error; }
}

async function mediaUsage(fileId: string) {
  const [specialist] = await db.select({ id: specialistProfiles.userId }).from(specialistProfiles).where(eq(specialistProfiles.avatarFileId, fileId));
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.logoFileId, fileId));
  const [photo] = await db.select({ id: companyPhotos.id }).from(companyPhotos).where(eq(companyPhotos.fileId, fileId));
  return Boolean(specialist || company || photo);
}

async function resumeInUse(fileId: string) {
  const [specialist] = await db.select({ id: specialistProfiles.userId }).from(specialistProfiles)
    .where(eq(specialistProfiles.resumeFileId, fileId));
  return Boolean(specialist);
}

export async function readMedia(userId: string, fileId: string, url?: string) {
  const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, fileId));
  if (!file) fail(404, "MEDIA_NOT_FOUND", "Файл не найден");
  const published = await mediaUsage(fileId);
  if (file.ownerUserId !== userId && !published) fail(404, "MEDIA_NOT_FOUND", "Файл не найден");
  const size = url ? new URL(url).searchParams.get("size") : null;
  if (size !== null && size !== "64" && size !== "256") fail(422, "INVALID_MEDIA_SIZE", "Некорректный размер");
  const [assets] = file.kind === "AVATAR" ? await db.select().from(avatarAssets).where(eq(avatarAssets.fileId, fileId)) : [];
  let key = file.storageKey;
  if (assets && size === "256") key = assets.mediumStorageKey;
  if (assets && size === "64") key = assets.smallStorageKey;
  const bytes = await localFileStorage.read(key);
  const headers = new Headers({ "Content-Type": file.mimeType, "Content-Length": String(bytes.length), "X-Content-Type-Options": "nosniff", "Cache-Control": published ? "private, max-age=3600" : "private, no-store" });
  if (file.kind === "RESUME") headers.set("Content-Disposition", "attachment; filename=resume.pdf");
  return new Response(Buffer.from(bytes), { headers });
}

export async function readAvatarOriginal(userId: string, fileId: string) {
  const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, fileId));
  if (!file || file.ownerUserId !== userId || file.kind !== "AVATAR") fail(404, "MEDIA_NOT_FOUND", "Файл не найден");
  const [assets] = await db.select().from(avatarAssets).where(eq(avatarAssets.fileId, fileId));
  if (!assets) fail(404, "MEDIA_NOT_FOUND", "Оригинал недоступен");
  const bytes = await localFileStorage.read(assets.originalStorageKey);
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": assets.originalMimeType, "Content-Length": String(bytes.length), "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Disposition": "attachment" } });
}

export async function deleteUnusedMedia(userId: string, fileId: string) {
  const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, fileId));
  if (!file || file.ownerUserId !== userId) fail(404, "MEDIA_NOT_FOUND", "Файл не найден");
  if (await mediaUsage(fileId) || await resumeInUse(fileId)) fail(409, "MEDIA_IN_USE", "Файл используется");
  const [assets] = file.kind === "AVATAR" ? await db.select().from(avatarAssets).where(eq(avatarAssets.fileId, fileId)) : [];
  const keys = [file.storageKey, ...(assets ? [assets.originalStorageKey, assets.mediumStorageKey, assets.smallStorageKey] : [])];
  await Promise.all(keys.map(key => localFileStorage.remove(key)));
  await db.delete(mediaFiles).where(eq(mediaFiles.id, fileId));
}

export async function cleanupStagedAvatars() {
  const expired = await db.select({ id: mediaFiles.id, ownerUserId: mediaFiles.ownerUserId }).from(mediaFiles)
    .innerJoin(avatarAssets, eq(avatarAssets.fileId, mediaFiles.id))
    .where(and(eq(mediaFiles.kind, "AVATAR"), lt(mediaFiles.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))).limit(50);
  for (const file of expired) {
    if (await mediaUsage(file.id)) continue;
    try { await deleteUnusedMedia(file.ownerUserId, file.id); }
    catch (error) { console.error("avatar cleanup failed", { fileId: file.id, error }); }
  }
}

export async function cleanupStagedResumes() {
  const expired = await db.select({ id: mediaFiles.id, ownerUserId: mediaFiles.ownerUserId }).from(mediaFiles)
    .where(and(eq(mediaFiles.kind, "RESUME"), lt(mediaFiles.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))).limit(50);
  for (const file of expired) {
    if (await resumeInUse(file.id)) continue;
    try { await deleteUnusedMedia(file.ownerUserId, file.id); }
    catch (error) { console.error("resume cleanup failed", { fileId: file.id, error }); }
  }
}
