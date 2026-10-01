import { z } from "zod";
import { auth } from "@/server/auth/auth";
import { bodyJson, fail, jsonError, sameOrigin } from "@/server/http";
const schema = z.object({ email: z.email().transform(x => x.trim().toLowerCase()), password: z.string() });
export async function POST(request: Request) { try {
  sameOrigin(request);
  const parsed = schema.safeParse(await bodyJson(request)); if (!parsed.success) return fail(422, "VALIDATION_ERROR", "Проверьте поля формы");
  const response = await auth.api.signInEmail({ body: parsed.data, asResponse: true, headers: request.headers });
  if (!response.ok) return Response.json({ error: { code: "INVALID_CREDENTIALS", message: "Неверный email или пароль", details: {} } }, { status: 401 });
  const result = await response.json();
  const outgoing = Response.json({ user: { id: result.user.id, email: result.user.email, role: result.user.role } });
  response.headers.forEach((value, key) => { if (key.toLowerCase() === "set-cookie") outgoing.headers.append(key, value); });
  return outgoing;
} catch (error) { return jsonError(error); } }
