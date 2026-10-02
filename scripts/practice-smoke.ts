import { eq } from "drizzle-orm";
import { db, pool } from "../src/db/client";
import { companies, companySocialLinks, practiceInvitations, practiceRecruitments, specialistProfiles, specialistSkills } from "../src/db/schema";
import { createPracticeInvitation, ownPracticeRecruitment, practiceContacts, practiceMatches, savePracticeRecruitment, transitionPracticeInvitation } from "../src/server/practice/service";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

async function main() {
  const [company] = await db.select().from(companies).limit(1); assert(company, "Seed company missing");
  const candidates = await db.select().from(specialistProfiles).where(eq(specialistProfiles.employmentGoal, "PRACTICE"));
  const candidate = candidates.find(row => row.desiredDirections?.includes("backend") && row.searchStatus !== "NOT_LOOKING" && row.practiceWorkFormats?.includes("REMOTE"));
  assert(candidate, "Seed backend practice candidate missing");
  const [skill] = await db.select().from(specialistSkills).where(eq(specialistSkills.specialistUserId, candidate.userId)); assert(skill, "Candidate skill missing");
  const other = candidates.find(row => row.userId !== candidate.userId && row.desiredDirections?.includes("backend") && row.searchStatus !== "NOT_LOOKING" && row.practiceWorkFormats?.includes("REMOTE"));
  assert(other, "Second backend candidate missing");
  let recruitmentId: string | null = null;
  let socialLinkId: string | null = null;
  try {
    const [socialLink] = await db.insert(companySocialLinks).values({ companyId: company.id, platform: "OTHER", value: `practice-smoke-${crypto.randomUUID()}`, sortOrder: 100 }).returning({ id: companySocialLinks.id });
    socialLinkId = socialLink.id;
    const recruitment = await savePracticeRecruitment(company.ownerUserId, null, { title: "Practice smoke", description: "Temporary test recruitment", direction: "backend", slotsTotal: 1, practiceStartDate: "2027-03-01", practiceEndDate: "2027-04-30", workFormats: ["REMOTE"], cityId: null, requiredSkillIds: [skill.skillId], optionalSkillIds: [], studyCourseMin: null, studyCourseMax: null, officialPracticeSupport: true, status: "ACTIVE" });
    recruitmentId = recruitment.id;
    const list = await practiceMatches(company.ownerUserId, recruitmentId, "http://localhost/api/v1/practice-recruitments/x/matches");
    assert(list.items.some(item => item.candidate.userId === candidate.userId), "Candidate absent from matches");
    assert(list.items.every((item, index) => index === 0 || list.items[index - 1].score >= item.score), "Matches not sorted by score");
    const filtered = await practiceMatches(company.ownerUserId, recruitmentId, "http://localhost/api/v1/practice-recruitments/x/matches?studyCourse=1");
    assert(filtered.items.length === 0, "Course filter ignored");
    const first = await createPracticeInvitation(company.ownerUserId, recruitmentId, { candidateUserId: candidate.userId, message: "Smoke invitation" });
    let lockedTerms = false; try { await savePracticeRecruitment(company.ownerUserId, recruitmentId, { title: "Changed", description: "Changed", direction: "backend", slotsTotal: 1, practiceStartDate: "2027-03-01", practiceEndDate: "2027-04-30", workFormats: ["REMOTE"], cityId: null, requiredSkillIds: [skill.skillId], optionalSkillIds: [], studyCourseMin: null, studyCourseMax: null, officialPracticeSupport: true, status: "ACTIVE" }); } catch { lockedTerms = true; } assert(lockedTerms, "Recruitment terms changed after invitation");
    let duplicate = false; try { await createPracticeInvitation(company.ownerUserId, recruitmentId, { candidateUserId: candidate.userId, message: "Duplicate" }); } catch { duplicate = true; } assert(duplicate, "Duplicate invitation accepted");
    let locked = false; try { await practiceContacts(candidate.userId, "SPECIALIST", first.id); } catch { locked = true; } assert(locked, "Contacts opened before acceptance");
    await transitionPracticeInvitation(candidate.userId, "SPECIALIST", first.id, "decline");
    const second = await createPracticeInvitation(company.ownerUserId, recruitmentId, { candidateUserId: candidate.userId, message: "Retry invitation" });
    await transitionPracticeInvitation(candidate.userId, "SPECIALIST", second.id, "accept");
    const candidateContacts = await practiceContacts(candidate.userId, "SPECIALIST", second.id);
    assert(candidateContacts.socialLinks?.some(link => link.value.startsWith("practice-smoke-")) === true, "Company social links missing after practice invitation acceptance");
    const contacts = await practiceContacts(company.ownerUserId, "EMPLOYER", second.id); assert(contacts.email, "Employer cannot see accepted contact");
    await transitionPracticeInvitation(company.ownerUserId, "EMPLOYER", second.id, "interview");
    await transitionPracticeInvitation(company.ownerUserId, "EMPLOYER", second.id, "hired");
    const completed = await ownPracticeRecruitment(company.ownerUserId, recruitmentId); assert(completed.status === "COMPLETED", "Recruitment did not complete at capacity");
    let full = false; try { await createPracticeInvitation(company.ownerUserId, recruitmentId, { candidateUserId: other.userId, message: "Too late" }); } catch { full = true; } assert(full, "Invitation accepted after capacity filled");
    console.log("Practice smoke passed: match, duplicate, retry, contact gate, funnel, capacity");
  } finally {
    if (socialLinkId) await db.delete(companySocialLinks).where(eq(companySocialLinks.id, socialLinkId));
    if (recruitmentId) { await db.delete(practiceInvitations).where(eq(practiceInvitations.practiceRecruitmentId, recruitmentId)); await db.delete(practiceRecruitments).where(eq(practiceRecruitments.id, recruitmentId)); }
    await pool.end();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
