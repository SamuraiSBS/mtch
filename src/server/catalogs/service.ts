import { db } from "@/db/client";
import { cities, professions, skills } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { fail } from "@/server/http";

export async function listCatalog(kind: "professions" | "cities" | "skills") { const table = { professions, cities, skills }[kind]; return db.select({ id: table.id, name: table.name }).from(table).where(eq(table.isActive, true)).orderBy(table.sortOrder, table.name); }
export async function requireCatalogId(kind: "professions" | "cities" | "skills", id: string) { const table = { professions, cities, skills }[kind]; const rows = await db.select({ id: table.id }).from(table).where(eq(table.id, id)); if (!rows.length) fail(422, "UNKNOWN_CATALOG_ITEM", `Неизвестное значение ${kind}`); const active = await db.select({ id: table.id }).from(table).where(eq(table.isActive, true)); if (!active.some(x => x.id === id)) fail(422, "INACTIVE_CATALOG_ITEM", `Неактивное значение ${kind}`); }
export async function requireSkills(ids: string[]) { if (new Set(ids).size !== ids.length) fail(422, "DUPLICATE_SKILL", "Повторяющийся навык"); const rows = await db.select({ id: skills.id }).from(skills).where(inArray(skills.id, ids)); if (rows.length !== ids.length) fail(422, "UNKNOWN_SKILL", "Неизвестный навык"); const active = await db.select({ id: skills.id }).from(skills).where(eq(skills.isActive, true)); if (ids.some(id => !active.some(x => x.id === id))) fail(422, "INACTIVE_SKILL", "Неактивный навык"); }

function normalizeCatalogName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ru-RU");
}

export async function resolveOrCreateCity(name: string): Promise<string> {
  const cleanName = name.normalize("NFKC").replace(/\s+/g, " ").trim();
  const normalizedName = normalizeCatalogName(cleanName);
  if (!normalizedName) fail(422, "INVALID_CITY", "Укажите город");
  await db.insert(cities).values({ name: cleanName, normalizedName, sortOrder: 10000 }).onConflictDoNothing();
  const [city] = await db.select({ id: cities.id }).from(cities).where(eq(cities.normalizedName, normalizedName));
  if (!city) fail(422, "INVALID_CITY", "Не удалось сохранить город");
  return city.id;
}

export async function resolveOrCreateSkills(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const cleanName = name.normalize("NFKC").replace(/\s+/g, " ").trim();
    const normalizedName = normalizeCatalogName(cleanName);
    if (!normalizedName) continue;
    await db.insert(skills).values({ name: cleanName, normalizedName, sortOrder: 10000 }).onConflictDoNothing();
    const [skill] = await db.select({ id: skills.id }).from(skills).where(eq(skills.normalizedName, normalizedName));
    if (!skill) fail(422, "INVALID_SKILL", `Не удалось сохранить навык «${cleanName}»`);
    ids.push(skill.id);
  }
  return ids;
}
