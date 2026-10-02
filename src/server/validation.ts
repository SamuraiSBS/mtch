import { z } from "zod";
import { fail } from "./http";

const optionalUrl = z.union([z.url().max(500), z.literal(""), z.null()]).optional().transform(v => v || null);
const optionalText = (max: number) => z.union([z.string().max(max), z.null()]).optional().transform(v => v || null);
export const salary = { salaryMinRub: z.number().int().positive(), salaryMaxRub: z.number().int().positive() };
const salaryCheck = (x: { salaryMinRub: number; salaryMaxRub: number }) => x.salaryMinRub <= x.salaryMaxRub;
export const directions = ["backend", "frontend", "mobile", "qa", "devops", "data_science", "machine_learning", "cybersecurity", "gamedev", "ui_ux", "other"] as const;
export const workFormats = ["REMOTE", "HYBRID", "OFFICE"] as const;
const practiceFields = {
  educationalInstitution: z.string().trim().min(1).max(200).nullable().optional(), educationProgram: z.string().trim().min(1).max(200).nullable().optional(),
  studyCourse: z.number().int().min(1).max(6).nullable().optional(), practiceStartDate: z.iso.date().nullable().optional(), practiceEndDate: z.iso.date().nullable().optional(),
  desiredDirections: z.array(z.enum(directions)).min(1).max(3).nullable().optional(), practiceWorkFormats: z.array(z.enum(workFormats)).min(1).nullable().optional(),
};
export const specialistInput = z.object({
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), birthDate: z.iso.date().nullable().optional(), cityId: z.uuid().nullable().optional(), avatarFileId: z.uuid(), professionId: z.uuid(),
  experience: z.enum(["NONE", "UNDER_1", "FROM_1_TO_3", "FROM_3_TO_5", "OVER_5"]).nullable().optional(), level: z.enum(["INTERN", "JUNIOR", "MIDDLE", "SENIOR"]).nullable().optional(), cooperationType: z.enum(["STAFF", "PROJECT", "FREELANCE", "INTERNSHIP"]).nullable().optional(),
  skillIds: z.array(z.uuid()).min(1), about: optionalText(500), portfolioUrl: optionalUrl, githubUrl: optionalUrl, behanceGitlabUrl: optionalUrl, telegram: optionalText(100),
  salaryMinRub: z.number().int().positive().nullable(), salaryMaxRub: z.number().int().positive().nullable(), workFormat: z.enum(workFormats).nullable().optional(), employmentType: z.enum(["FULL_TIME", "PART_TIME", "PROJECT", "INTERNSHIP"]).nullable().optional(), searchStatus: z.enum(["ACTIVE", "OPEN_TO_OFFERS", "NOT_LOOKING"]).default("OPEN_TO_OFFERS"),
  employmentGoal: z.enum(["JOB", "INTERNSHIP", "PRACTICE", "OPEN_TO_OFFERS"]).default("OPEN_TO_OFFERS"), ...practiceFields,
}).superRefine((x, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (x.employmentGoal === "PRACTICE") {
    if (x.salaryMinRub !== null || x.salaryMaxRub !== null) issue("salaryMinRub", "Для практики зарплата не указывается");
    for (const key of ["educationalInstitution", "educationProgram", "studyCourse", "practiceStartDate", "practiceEndDate", "desiredDirections", "practiceWorkFormats"] as const) if (!x[key] || Array.isArray(x[key]) && x[key].length === 0) issue(key, "Поле обязательно для практики");
    if (x.practiceStartDate && x.practiceEndDate && x.practiceEndDate <= x.practiceStartDate) issue("practiceEndDate", "Дата окончания должна быть позже начала");
    if (x.practiceWorkFormats?.some(v => v !== "REMOTE") && !x.cityId) issue("cityId", "Для офиса или гибрида укажите город");
    if (x.desiredDirections && new Set(x.desiredDirections).size !== x.desiredDirections.length) issue("desiredDirections", "Направления не должны повторяться");
    if (x.practiceWorkFormats && new Set(x.practiceWorkFormats).size !== x.practiceWorkFormats.length) issue("practiceWorkFormats", "Форматы не должны повторяться");
  } else if (!x.salaryMinRub || !x.salaryMaxRub || x.salaryMaxRub < x.salaryMinRub) issue("salaryMaxRub", "Укажите корректный диапазон зарплаты");
});
export const companySocialPlatforms = ["TELEGRAM", "VK", "LINKEDIN", "YOUTUBE", "INSTAGRAM", "TIKTOK", "X", "OTHER"] as const;
export const companyPhotoCategories = ["OFFICE", "TEAM", "WORKSPACE", "PROCESSES", "OTHER"] as const;
const companySocialLinkInput = z.object({
  platform: z.enum(companySocialPlatforms),
  value: z.string().trim().min(1).max(500),
});
const companyPhotoInput = z.object({
  fileId: z.uuid(),
  category: z.enum(companyPhotoCategories),
  sortOrder: z.number().int().min(0),
});
export const companyInput = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(500),
  workFormat: z.enum(["REMOTE", "HYBRID", "OFFICE"]),
  foundedYear: z.number().int().min(1800).max(new Date().getFullYear()),
  sizeBand: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]),
  industry: z.string().trim().min(1).max(120),
  websiteUrl: optionalUrl,
  logoFileId: z.uuid(),
  contactEmail: z.union([z.email(), z.literal(""), z.null()]).optional().transform(v => v || null),
  telegram: optionalText(100),
  phone: optionalText(50),
  socialLinks: z.array(companySocialLinkInput).optional(),
  photos: z.array(companyPhotoInput).max(20).optional(),
}).superRefine((company, ctx) => {
  const seenLinks = new Set<string>();
  for (const [index, link] of (company.socialLinks ?? []).entries()) {
    const key = `${link.platform}:${link.value.normalize("NFKC").toLocaleLowerCase("ru-RU")}`;
    if (seenLinks.has(key)) ctx.addIssue({ code: "custom", path: ["socialLinks", index, "value"], message: "Эта запись уже добавлена" });
    seenLinks.add(key);
  }

  const seenPhotos = new Set<string>();
  const seenOrders = new Set<string>();
  for (const [index, photo] of (company.photos ?? []).entries()) {
    if (seenPhotos.has(photo.fileId)) ctx.addIssue({ code: "custom", path: ["photos", index, "fileId"], message: "Фото не должно повторяться" });
    seenPhotos.add(photo.fileId);
    const order = `${photo.category}:${photo.sortOrder}`;
    if (seenOrders.has(order)) ctx.addIssue({ code: "custom", path: ["photos", index, "sortOrder"], message: "Порядок фото в группе должен быть уникальным" });
    seenOrders.add(order);
  }
});
export const searchInput = z.object({ title: z.string().trim().min(1).max(160), professionId: z.uuid(), targetLevel: z.enum(["INTERN", "JUNIOR", "MIDDLE", "SENIOR"]), minimumExperience: z.enum(["NONE", "UNDER_1", "FROM_1_TO_3", "FROM_3_TO_5", "OVER_5"]), skillIds: z.array(z.uuid()).min(1), ...salary, workFormat: z.enum(["REMOTE", "HYBRID", "OFFICE"]), employmentType: z.enum(["FULL_TIME", "PART_TIME", "PROJECT", "INTERNSHIP"]) }).refine(salaryCheck, { path: ["salaryMaxRub"], message: "Максимальная зарплата ниже минимальной" });
export const offerInput = z.object({ specialistUserId: z.string().uuid(), searchProfileId: z.uuid(), positionTitle: z.string().trim().min(1).max(160), ...salary, description: z.string().trim().min(1).max(5000), workFormat: z.enum(["REMOTE", "HYBRID", "OFFICE"]), employmentType: z.enum(["FULL_TIME", "PART_TIME", "PROJECT", "INTERNSHIP"]), message: z.string().trim().min(1).max(3000) }).refine(salaryCheck, { path: ["salaryMaxRub"], message: "Максимальная зарплата ниже минимальной" });
export const practiceRecruitmentInput = z.object({
  title: z.string().trim().min(1).max(160), description: z.string().trim().min(1).max(5000), direction: z.enum(directions), slotsTotal: z.number().int().min(1).max(1000),
  practiceStartDate: z.iso.date(), practiceEndDate: z.iso.date(), workFormats: z.array(z.enum(workFormats)).min(1), cityId: z.uuid().nullable(),
  requiredSkillIds: z.array(z.uuid()).min(1), optionalSkillIds: z.array(z.uuid()), studyCourseMin: z.number().int().min(1).max(6).nullable(), studyCourseMax: z.number().int().min(1).max(6).nullable(),
  officialPracticeSupport: z.boolean(), status: z.enum(["DRAFT", "ACTIVE"]).default("ACTIVE"),
}).superRefine((x, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (x.practiceEndDate <= x.practiceStartDate) issue("practiceEndDate", "Дата окончания должна быть позже начала");
  if (x.workFormats.some(v => v !== "REMOTE") && !x.cityId) issue("cityId", "Для офиса или гибрида укажите город");
  if (x.studyCourseMin && x.studyCourseMax && x.studyCourseMax < x.studyCourseMin) issue("studyCourseMax", "Максимальный курс ниже минимального");
  if (x.requiredSkillIds.some(id => x.optionalSkillIds.includes(id))) issue("optionalSkillIds", "Навык не может быть обязательным и желательным одновременно");
  if (new Set(x.requiredSkillIds).size !== x.requiredSkillIds.length || new Set(x.optionalSkillIds).size !== x.optionalSkillIds.length) issue("requiredSkillIds", "Навыки не должны повторяться");
  if (new Set(x.workFormats).size !== x.workFormats.length) issue("workFormats", "Форматы не должны повторяться");
});
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> { const result = schema.safeParse(input); if (!result.success) return fail(422, "VALIDATION_ERROR", "Проверьте поля формы", result.error.flatten()); return result.data; }
