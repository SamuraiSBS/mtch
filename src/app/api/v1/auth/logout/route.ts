import { auth } from "@/server/auth/auth";
import { jsonError, requireUser, sameOrigin } from "@/server/http";
export async function POST(request: Request) { try { sameOrigin(request); await requireUser(request); const response = await auth.api.signOut({ headers: request.headers, asResponse: true }); const outgoing = new Response(null, { status: 204 }); response.headers.forEach((value, key) => { if (key.toLowerCase() === "set-cookie") outgoing.headers.append(key, value); }); return outgoing; } catch (error) { return jsonError(error); } }
