import { describe, expect, it } from "vitest";
import { specialistInput, practiceRecruitmentInput } from "@/server/validation";

const id = "00000000-0000-4000-8000-000000000001";
const base = { firstName: "Алексей", lastName: "Иванов", avatarFileId: id, professionId: id, skillIds: [id], salaryMinRub: null, salaryMaxRub: null, employmentGoal: "PRACTICE", cityId: null, educationalInstitution: "РКСИ", educationProgram: "Программирование", studyCourse: 4, practiceStartDate: "2027-03-01", practiceEndDate: "2027-04-30", desiredDirections: ["backend"], practiceWorkFormats: ["REMOTE"] };
describe("practice validation", () => {
  it("accepts practice without salary", () => expect(specialistInput.safeParse(base).success).toBe(true));
  it("requires city for hybrid and valid dates", () => {
    expect(specialistInput.safeParse({ ...base, practiceWorkFormats: ["HYBRID"] }).success).toBe(false);
    expect(specialistInput.safeParse({ ...base, practiceEndDate: "2027-03-01" }).success).toBe(false);
  });
  it("keeps salary mandatory for other goals", () => expect(specialistInput.safeParse({ ...base, employmentGoal: "JOB" }).success).toBe(false));
  it("validates recruitment limits", () => {
    const recruitment = { title: "Backend", description: "Практика", direction: "backend", slotsTotal: 5, practiceStartDate: "2027-03-01", practiceEndDate: "2027-04-30", workFormats: ["REMOTE"], cityId: null, requiredSkillIds: [id], optionalSkillIds: [], studyCourseMin: 2, studyCourseMax: 6, officialPracticeSupport: true };
    expect(practiceRecruitmentInput.safeParse(recruitment).success).toBe(true);
    expect(practiceRecruitmentInput.safeParse({ ...recruitment, slotsTotal: 0 }).success).toBe(false);
  });
});
