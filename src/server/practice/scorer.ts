import type { InferSelectModel } from "drizzle-orm";
import { practiceRecruitments, specialistProfiles } from "@/db/schema";

type Recruitment = InferSelectModel<typeof practiceRecruitments>;
type Specialist = InferSelectModel<typeof specialistProfiles>;
export type PracticeCandidate = Specialist & { skillIds: string[] };
export type MatchReason = { type: "positive" | "warning"; text: string };

export function practiceScore(recruitment: Recruitment, candidate: PracticeCandidate): { score: number; reasons: MatchReason[] } | null {
  if (candidate.employmentGoal !== "PRACTICE" || candidate.searchStatus === "NOT_LOOKING" || !candidate.practiceStartDate || !candidate.practiceEndDate || !candidate.desiredDirections?.includes(recruitment.direction)) return null;
  if (candidate.practiceStartDate > recruitment.practiceEndDate || candidate.practiceEndDate < recruitment.practiceStartDate) return null;
  if (recruitment.studyCourseMin && (!candidate.studyCourse || candidate.studyCourse < recruitment.studyCourseMin)) return null;
  if (recruitment.studyCourseMax && (!candidate.studyCourse || candidate.studyCourse > recruitment.studyCourseMax)) return null;
  const commonFormats = (candidate.practiceWorkFormats ?? []).filter(format => recruitment.workFormats.includes(format));
  const compatibleFormats = commonFormats.filter(format => format === "REMOTE" || candidate.cityId && candidate.cityId === recruitment.cityId);
  if (!compatibleFormats.length) return null;
  const requiredMatches = recruitment.requiredSkillIds.filter(id => candidate.skillIds.includes(id));
  const optionalMatches = recruitment.optionalSkillIds.filter(id => candidate.skillIds.includes(id));
  const reasons: MatchReason[] = [
    { type: "positive", text: "Направление совпадает" }, { type: "positive", text: "Период практики пересекается" }, { type: "positive", text: "Формат подходит" },
  ];
  if (requiredMatches.length) reasons.push({ type: "positive", text: `Обязательные навыки: ${requiredMatches.length} из ${recruitment.requiredSkillIds.length}` });
  if (requiredMatches.length < recruitment.requiredSkillIds.length) reasons.push({ type: "warning", text: `Не хватает обязательных навыков: ${recruitment.requiredSkillIds.length - requiredMatches.length}` });
  if (optionalMatches.length) reasons.push({ type: "positive", text: `Дополнительные навыки: ${optionalMatches.length}` });
  if (candidate.githubUrl || candidate.portfolioUrl) reasons.push({ type: "positive", text: "Есть GitHub или портфолио" });
  if (candidate.experience && candidate.experience !== "NONE") reasons.push({ type: "positive", text: "Указан опыт" });
  const required = 40 * requiredMatches.length / Math.max(1, recruitment.requiredSkillIds.length);
  const optional = recruitment.optionalSkillIds.length ? 15 * optionalMatches.length / recruitment.optionalSkillIds.length : 15;
  const evidence = (candidate.githubUrl || candidate.portfolioUrl ? 8 : 0) + (candidate.experience && candidate.experience !== "NONE" ? 7 : 0);
  const score = Math.max(0, Math.min(100, Math.round(required + optional + evidence + 25 + 5)));
  return { score, reasons };
}
