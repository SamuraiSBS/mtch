import { describe, expect, it } from "vitest";
import { practiceScore } from "./scorer";
import type { InferSelectModel } from "drizzle-orm";
import { practiceRecruitments, specialistProfiles } from "@/db/schema";

const recruitment = { direction: "backend", practiceStartDate: "2027-03-01", practiceEndDate: "2027-04-30", workFormats: ["REMOTE", "HYBRID"], cityId: "city-a", requiredSkillIds: ["python", "sql"], optionalSkillIds: ["docker"], studyCourseMin: 2, studyCourseMax: 5 } as InferSelectModel<typeof practiceRecruitments>;
const candidate = { userId: "a", employmentGoal: "PRACTICE", searchStatus: "ACTIVE", practiceStartDate: "2027-02-01", practiceEndDate: "2027-03-31", desiredDirections: ["backend"], practiceWorkFormats: ["REMOTE"], cityId: null, studyCourse: 4, githubUrl: "https://github.com/example", portfolioUrl: null, experience: "UNDER_1", skillIds: ["python", "sql", "docker"] } as InferSelectModel<typeof specialistProfiles> & { skillIds: string[] };

describe("practice scoring", () => {
  it("scores a full match with factual explanations", () => { const result = practiceScore(recruitment, candidate); expect(result?.score).toBe(100); expect(result?.reasons.some(x => x.text.includes("GitHub"))).toBe(true); });
  it("rejects non-practice goals, dates, direction, format and course", () => {
    expect(practiceScore(recruitment, { ...candidate, employmentGoal: "JOB" })).toBeNull();
    expect(practiceScore(recruitment, { ...candidate, practiceStartDate: "2027-05-01" })).toBeNull();
    expect(practiceScore(recruitment, { ...candidate, desiredDirections: ["qa"] })).toBeNull();
    expect(practiceScore(recruitment, { ...candidate, practiceWorkFormats: ["OFFICE"] })).toBeNull();
    expect(practiceScore(recruitment, { ...candidate, studyCourse: 1 })).toBeNull();
  });
  it("requires matching city for in-person formats and keeps score bounded", () => {
    expect(practiceScore(recruitment, { ...candidate, practiceWorkFormats: ["HYBRID"], cityId: "city-b" })).toBeNull();
    const result = practiceScore(recruitment, { ...candidate, skillIds: [] });
    expect(result?.score).toBeGreaterThanOrEqual(0); expect(result?.score).toBeLessThanOrEqual(100);
    expect(result?.reasons.some(x => x.type === "warning")).toBe(true);
  });
});
