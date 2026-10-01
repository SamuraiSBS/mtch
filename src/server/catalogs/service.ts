import { db } from "@/db/client";
import { cities, professions, skills } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { fail } from "@/server/http";

export async function listCatalog(kind: "professions" | "cities" | "skills") { const table = { professions, cities, skills }[kind]; return db.select({ id: table.id, name: table.name }).from(table).where(eq(table.isActive, true)).orderBy(table.sortOrder, table.name); }
export async function requireCatalogId(kind: "professions" | "cities" | "skills", id: string) { const table = { professions, cities, skills }[kind]; const rows = await db.select({ id: table.id }).from(table).where(eq(table.id, id)); if (!rows.length) fail(422, "UNKNOWN_CATALOG_ITEM", `Неизвестное значение ${kind}`); const active = await db.select({ id: table.id }).from(table).where(eq(table.isActive, true)); if (!active.some(x => x.id === id)) fail(422, "INACTIVE_CATALOG_ITEM", `Неактивное значение ${kind}`); }
export async function requireSkills(ids: string[]) { if (new Set(ids).size !== ids.length) fail(422, "DUPLICATE_SKILL", "Повторяющийся навык"); const rows = await db.select({ id: skills.id }).from(skills).where(inArray(skills.id, ids)); if (rows.length !== ids.length) fail(422, "UNKNOWN_SKILL", "Неизвестный навык"); const active = await db.select({ id: skills.id }).from(skills).where(eq(skills.isActive, true)); if (ids.some(id => !active.some(x => x.id === id))) fail(422, "INACTIVE_SKILL", "Неактивный навык"); }
