import { describe, expect, it } from "vitest";
import { deterministicScorer } from "./scorer";
const search = { professionId: "frontend", targetLevel: "MIDDLE", minimumExperience: "FROM_1_TO_3" as const, skillIds: ["react", "ts"], salaryMinRub: 100000, salaryMaxRub: 200000, workFormat: "REMOTE", employmentType: "FULL_TIME" };
const candidate = { professionId: "frontend", level: "MIDDLE", experience: "FROM_3_TO_5" as const, skillIds: ["react", "ts"], salaryMinRub: 150000, salaryMaxRub: 250000, workFormat: "REMOTE", employmentType: "FULL_TIME" };
describe("deterministic scoring", () => {
  it("returns 100 for matching criteria", () => expect(deterministicScorer.score(search, candidate)).toBe(100));
  it("gives skills 40 weighted points", () => expect(deterministicScorer.score(search, { ...candidate, skillIds: [] })).toBe(60));
  it("handles missing optional fields and non-overlapping salary", () => expect(deterministicScorer.score(search, { ...candidate, level: null, experience: null, workFormat: null, employmentType: null, salaryMinRub: 300000, salaryMaxRub: 400000 })).toBe(60));
  it("treats minimum experience inclusively", () => expect(deterministicScorer.score(search, { ...candidate, experience: "FROM_1_TO_3" })).toBe(100));
  it("treats salary endpoints as overlapping", () => expect(deterministicScorer.score(search, { ...candidate, salaryMinRub: 200000, salaryMaxRub: 300000 })).toBe(100));
});
