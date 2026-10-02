import { z } from "zod";
import { bodyJson, fail, jsonError, requireUser, sameOrigin } from "@/server/http";
import { listCatalog } from "@/server/catalogs/service";
import { specialistDetail, saveSpecialist } from "@/server/specialists/service";
import { addCompanyPhoto, addSocialLink, companyDetail, ownCompany, removeCompanyPhoto, removeSocialLink, saveCompany } from "@/server/companies/service";
import { listSearchProfiles, removeSearchProfile, saveSearchProfile, searchDetail } from "@/server/search-profiles/service";
import { candidateFeed } from "@/server/feed/service";
import { createOffer, listOffers, offerDetail, transitionOffer, listMatches, matchDetail, matchContacts } from "@/server/offers/service";
import { deleteUnusedMedia, readAvatarOriginal, readMedia, uploadMedia } from "@/server/storage/media";
import { changePracticeRecruitmentStatus, createPracticeInvitation, listPracticeInvitations, listPracticeRecruitments, practiceContacts, practiceInvitationDetail, practiceMatches, practiceRecruitmentDetail, savePracticeRecruitment, transitionPracticeInvitation } from "@/server/practice/service";

type Context = { params: Promise<{ path: string[] }> };
async function dispatch(request: Request, context: Context) {
  const parts = (await context.params).path, method = request.method;
  if (method !== "GET") sameOrigin(request);
  const role = parts[0] === "specialists" && parts[1] === "me" ? "SPECIALIST" : parts[0] === "companies" && parts[1] === "me" ? "EMPLOYER" : parts[0] === "search-profiles" || parts[0] === "feed" || parts[0] === "practice-recruitments" ? "EMPLOYER" : parts[0] === "offers" && (parts[1] === "outgoing" || method === "POST" && parts.length === 1) ? "EMPLOYER" : parts[0] === "offers" && parts[1] === "incoming" ? "SPECIALIST" : undefined;
  const user = await requireUser(request, role);
  const input = async () => bodyJson(request);
  const id = (index: number) => { const value = parts[index]; if (!value || !z.uuid().safeParse(value).success) fail(404, "NOT_FOUND", "Ресурс не найден"); return value; };
  if (parts[0] === "catalogs" && method === "GET" && parts.length === 2 && ["professions", "cities", "skills"].includes(parts[1])) return Response.json(await listCatalog(parts[1] as "professions" | "cities" | "skills"));
  if (parts[0] === "specialists") {
    if (parts[1] === "me" && parts.length === 2) {
      if (method === "GET") return Response.json(await specialistDetail(user.id, true));
      if (method === "POST" || method === "PUT") return Response.json(await saveSpecialist(user.id, await input(), method === "POST"), { status: method === "POST" ? 201 : 200 });
    }
    if (method === "GET" && parts.length === 2) return Response.json(await specialistDetail(id(1), user.id === parts[1]));
  }
  if (parts[0] === "companies") {
    if (parts[1] === "me") {
      if (parts.length === 2) {
        if (method === "GET") { const company = await ownCompany(user.id); return Response.json(await companyDetail(company.id, true)); }
        if (method === "POST" || method === "PUT") return Response.json(await saveCompany(user.id, await input(), method === "POST"), { status: method === "POST" ? 201 : 200 });
      }
      if (parts[2] === "photos" && parts.length === 3 && method === "POST") return Response.json(await addCompanyPhoto(user.id, await input()), { status: 201 });
      if (parts[2] === "photos" && parts.length === 4 && method === "DELETE") { await removeCompanyPhoto(user.id, id(3)); return new Response(null, { status: 204 }); }
      if (parts[2] === "social-links" && parts.length === 3 && method === "POST") return Response.json(await addSocialLink(user.id, await input()), { status: 201 });
      if (parts[2] === "social-links" && parts.length === 4 && method === "DELETE") { await removeSocialLink(user.id, id(3)); return new Response(null, { status: 204 }); }
    }
    if (parts.length === 2 && method === "GET") return Response.json(await companyDetail(id(1)));
  }
  if (parts[0] === "search-profiles") {
    if (parts.length === 1) {
      if (method === "GET") return Response.json(await listSearchProfiles(user.id));
      if (method === "POST") return Response.json(await saveSearchProfile(user.id, null, await input()), { status: 201 });
    }
    if (parts.length === 2) {
      const profileId = id(1);
      if (method === "GET") return Response.json(await searchDetail(user.id, profileId));
      if (method === "PUT") return Response.json(await saveSearchProfile(user.id, profileId, await input()));
      if (method === "DELETE") { await removeSearchProfile(user.id, profileId); return new Response(null, { status: 204 }); }
    }
  }
  if (parts[0] === "feed" && parts[1] === "specialists" && parts.length === 2 && method === "GET") return Response.json(await candidateFeed(user.id, request.url));
  if (parts[0] === "practice-recruitments") {
    if (parts.length === 1 && method === "GET") return Response.json(await listPracticeRecruitments(user.id, request.url));
    if (parts.length === 1 && method === "POST") return Response.json(await savePracticeRecruitment(user.id, null, await input()), { status: 201 });
    if (parts.length >= 2) {
      const recruitmentId = id(1);
      if (parts.length === 2 && method === "GET") return Response.json(await practiceRecruitmentDetail(user.id, recruitmentId));
      if (parts.length === 2 && method === "PUT") return Response.json(await savePracticeRecruitment(user.id, recruitmentId, await input()));
      if (parts.length === 3 && parts[2] === "status" && method === "POST") { const body = await input(); return Response.json(await changePracticeRecruitmentStatus(user.id, recruitmentId, body && typeof body === "object" ? (body as { status?: unknown }).status : undefined)); }
      if (parts.length === 3 && parts[2] === "matches" && method === "GET") return Response.json(await practiceMatches(user.id, recruitmentId, request.url));
      if (parts.length === 3 && parts[2] === "invitations" && method === "GET") return Response.json(await listPracticeInvitations(user.id, "EMPLOYER", request.url, recruitmentId));
      if (parts.length === 3 && parts[2] === "invitations" && method === "POST") return Response.json(await createPracticeInvitation(user.id, recruitmentId, await input()), { status: 201 });
    }
  }
  if (parts[0] === "practice-invitations") {
    if (parts.length === 1 && method === "GET") return Response.json(await listPracticeInvitations(user.id, user.role, request.url));
    if (parts.length === 2 && method === "GET") return Response.json(await practiceInvitationDetail(user.id, id(1)));
    if (parts.length === 3 && parts[2] === "contacts" && method === "GET") return Response.json(await practiceContacts(user.id, user.role, id(1)));
    if (parts.length === 3 && method === "POST" && ["view", "accept", "decline", "interview", "hired"].includes(parts[2])) return Response.json(await transitionPracticeInvitation(user.id, user.role, id(1), parts[2] as "view" | "accept" | "decline" | "interview" | "hired"));
  }
  if (parts[0] === "media") {
    if (parts.length === 1 && method === "POST") {
      const size = Number(request.headers.get("content-length"));
      if (size > 6 * 1024 * 1024) fail(413, "FILE_TOO_LARGE", "Файл больше 5 МБ");
      return Response.json(await uploadMedia(user.id, user.role, await request.formData()), { status: 201 });
    }
    if (parts.length === 2 && method === "GET") return readMedia(user.id, id(1), request.url);
    if (parts.length === 3 && parts[2] === "original" && method === "GET") return readAvatarOriginal(user.id, id(1));
    if (parts.length === 2 && method === "DELETE") { await deleteUnusedMedia(user.id, id(1)); return new Response(null, { status: 204 }); }
  }
  if (parts[0] === "offers") {
    if (parts.length === 1 && method === "POST") return Response.json(await createOffer(user.id, await input()), { status: 201 });
    if (parts.length === 2 && method === "GET" && (parts[1] === "incoming" || parts[1] === "outgoing")) return Response.json(await listOffers(user.id, parts[1], request.url));
    if (parts.length === 2 && method === "GET") return Response.json(await offerDetail(user.id, id(1)));
    if (parts.length === 3 && method === "POST" && ["accept", "reject", "withdraw"].includes(parts[2])) return Response.json(await transitionOffer(user.id, user.role, id(1), parts[2] as "accept" | "reject" | "withdraw"));
  }
  if (parts[0] === "matches") {
    if (parts.length === 1 && method === "GET") return Response.json(await listMatches(user.id, request.url));
    if (parts.length === 2 && method === "GET") return Response.json(await matchDetail(user.id, id(1)));
    if (parts.length === 3 && parts[2] === "contacts" && method === "GET") return Response.json(await matchContacts(user.id, id(1)));
  }
  fail(404, "NOT_FOUND", "Ресурс не найден");
}
async function handle(request: Request, context: Context) { try { return await dispatch(request, context); } catch (error) { return jsonError(error); } }
export const GET = handle, POST = handle, PUT = handle, DELETE = handle;
