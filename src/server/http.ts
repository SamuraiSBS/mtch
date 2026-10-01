import { auth, type Role } from "./auth/auth";

export class HttpError extends Error { constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); } }
export const fail = (status: number, code: string, message: string, details?: unknown): never => { throw new HttpError(status, code, message, details); };
export function jsonError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: { code: error.code, message: error.message, details: error.details ?? {} } }, { status: error.status });
  console.error(error);
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера", details: {} } }, { status: 500 });
}
export async function bodyJson(request: Request): Promise<unknown> { try { return await request.json(); } catch { return fail(400, "INVALID_JSON", "Некорректный JSON"); } }
export async function requireUser(request: Request, role?: Role) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return fail(401, "UNAUTHORIZED", "Требуется вход");
  const actualRole = session.user.role;
  if (actualRole !== "SPECIALIST" && actualRole !== "EMPLOYER") return fail(403, "INVALID_ROLE", "Роль аккаунта недоступна");
  if (role && actualRole !== role) return fail(403, "FORBIDDEN", "Недостаточно прав");
  return { ...session.user, role: actualRole };
}
export function pageParams(url: string) { const params = new URL(url).searchParams; const page = Number(params.get("page") ?? 1); const pageSize = Number(params.get("pageSize") ?? 20); if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) fail(422, "INVALID_PAGINATION", "Некорректная страница"); return { page, pageSize }; }
export function paged<T>(items: T[], page: number, pageSize: number) { return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length }; }
export function sameOrigin(request: Request) { const origin = request.headers.get("origin"); const allowed = new Set([new URL(request.url).origin]); if (process.env.BETTER_AUTH_URL) allowed.add(new URL(process.env.BETTER_AUTH_URL).origin); if (origin && !allowed.has(origin)) fail(403, "BAD_ORIGIN", "Недопустимый источник запроса"); }
