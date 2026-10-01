import { z } from "zod";
import { auth, withRegistrationRole } from "@/server/auth/auth";
import { bodyJson, fail, jsonError, sameOrigin } from "@/server/http";
const schema = z.object({ email: z.email().transform(x => x.trim().toLowerCase()), password: z.string().min(8).max(128), passwordConfirmation: z.string(), role: z.enum(["SPECIALIST", "EMPLOYER"]) }).refine(x => x.password === x.passwordConfirmation, { message: "Пароли не совпадают", path: ["passwordConfirmation"] });
export async function POST(request: Request) { try {
  sameOrigin(request);
  const parsed = schema.safeParse(await bodyJson(request));
  if (!parsed.success) return fail(422, "VALIDATION_ERROR", "Проверьте поля формы", parsed.error.flatten());
  const { email, password, role } = parsed.data;
  const response = await withRegistrationRole(role, () => auth.api.signUpEmail({ body: { email, password, name: "mtch user" }, asResponse: true, headers: request.headers }));
  if (!response.ok) return Response.json({ error: { code: response.status === 422 ? "EMAIL_EXISTS" : "AUTH_ERROR", message: "Регистрация не удалась", details: {} } }, { status: response.status });
  const result = await response.json();
  const outgoing = Response.json({ user: { id: result.user.id, email: result.user.email, role } }, { status: 201 });
  response.headers.forEach((value, key) => { if (key.toLowerCase() === "set-cookie") outgoing.headers.append(key, value); });
  return outgoing;
} catch (error) { return jsonError(error); } }
