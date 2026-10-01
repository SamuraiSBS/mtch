import { db } from "@/db/client";
import { companies, companyPhotos, mediaFiles, specialistProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fail } from "@/server/http";
import { localFileStorage } from "./local";

function detectedMime(bytes: Uint8Array) {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a) return "image/png";
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
export async function uploadMedia(userId: string, role: "SPECIALIST" | "EMPLOYER", form: FormData) {
  const kind = form.get("kind"), file = form.get("file");
  if (kind !== "AVATAR" && kind !== "COMPANY_LOGO" && kind !== "COMPANY_PHOTO") return fail(422, "INVALID_MEDIA_KIND", "Некорректный тип файла");
  if (role === "SPECIALIST" ? kind !== "AVATAR" : kind === "AVATAR") fail(403, "FORBIDDEN", "Недоступный тип файла");
  if (!(file instanceof File)) return fail(422, "FILE_REQUIRED", "Выберите файл");
  if (file.size > 5 * 1024 * 1024) fail(413, "FILE_TOO_LARGE", "Файл больше 5 МБ");
  const bytes = new Uint8Array(await file.arrayBuffer()), mime = detectedMime(bytes);
  if (!mime || mime !== file.type) return fail(415, "UNSUPPORTED_MEDIA", "Допускаются PNG, JPEG и WebP");
  const storageKey = await localFileStorage.save(bytes);
  try { const [record] = await db.insert(mediaFiles).values({ ownerUserId: userId, kind: kind as "AVATAR" | "COMPANY_LOGO" | "COMPANY_PHOTO", storageKey, mimeType: mime, byteSize: bytes.length }).returning(); return { fileId: record.id }; }
  catch (error) { await localFileStorage.remove(storageKey); throw error; }
}
export async function readMedia(userId: string, fileId: string) {
  const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, fileId));
  if (!file) fail(404, "MEDIA_NOT_FOUND", "Файл не найден");
  const [specialist] = await db.select({ id: specialistProfiles.userId }).from(specialistProfiles).where(eq(specialistProfiles.avatarFileId, fileId));
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.logoFileId, fileId));
  const [photo] = await db.select({ id: companyPhotos.id }).from(companyPhotos).where(eq(companyPhotos.fileId, fileId));
  if (file.ownerUserId !== userId && !specialist && !company && !photo) fail(404, "MEDIA_NOT_FOUND", "Файл не найден");
  const bytes = await localFileStorage.read(file.storageKey);
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": file.mimeType, "Content-Length": String(bytes.length), "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600" } });
}
export async function deleteUnusedMedia(userId: string, fileId: string) { const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, fileId)); if (!file || file.ownerUserId !== userId) fail(404, "MEDIA_NOT_FOUND", "Файл не найден"); const [specialist] = await db.select({ id: specialistProfiles.userId }).from(specialistProfiles).where(eq(specialistProfiles.avatarFileId, fileId)); const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.logoFileId, fileId)); const [photo] = await db.select({ id: companyPhotos.id }).from(companyPhotos).where(eq(companyPhotos.fileId, fileId)); if (specialist || company || photo) fail(409, "MEDIA_IN_USE", "Файл используется"); await db.delete(mediaFiles).where(eq(mediaFiles.id, fileId)); await localFileStorage.remove(file.storageKey); }
