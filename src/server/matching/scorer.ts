export const experienceRank = { NONE: 0, UNDER_1: 1, FROM_1_TO_3: 2, FROM_3_TO_5: 3, OVER_5: 4 } as const;
type Experience = keyof typeof experienceRank;
export interface SearchCriteria { professionId: string; targetLevel: string; minimumExperience: Experience; skillIds: string[]; salaryMinRub: number; salaryMaxRub: number; workFormat: string; employmentType: string }
export interface CandidateCriteria { professionId: string; level: string | null; experience: Experience | null; skillIds: string[]; salaryMinRub: number; salaryMaxRub: number; workFormat: string | null; employmentType: string | null }
export interface MatchingStrategy { score(search: SearchCriteria, candidate: CandidateCriteria): number }
export const deterministicScorer: MatchingStrategy = { score(search, candidate) {
  const common = search.skillIds.filter(id => candidate.skillIds.includes(id)).length;
  const score = 40 * common / search.skillIds.length
    + (search.professionId === candidate.professionId ? 20 : 0)
    + (search.targetLevel === candidate.level ? 10 : 0)
    + (candidate.experience && experienceRank[candidate.experience] >= experienceRank[search.minimumExperience] ? 8 : 0)
    + (candidate.salaryMinRub <= search.salaryMaxRub && search.salaryMinRub <= candidate.salaryMaxRub ? 8 : 0)
    + (search.workFormat === candidate.workFormat ? 7 : 0)
    + (search.employmentType === candidate.employmentType ? 7 : 0);
  return Math.max(0, Math.min(100, Math.round(score)));
} };
