import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { searchProfiles, searchProfileSkills, skills } from "@/db/schema";
import { fail } from "@/server/http";
import { ownCompany } from "@/server/companies/service";
import { specialistDetail } from "@/server/specialists/service";
import { createOffer } from "./service";

export async function sendEmployerInterest(employerUserId: string, specialistUserId: string) {
  const company = await ownCompany(employerUserId);
  const specialist = await specialistDetail(specialistUserId);
  if (specialist.employmentGoal === "PRACTICE") fail(409, "PRACTICE_ONLY", "Для практики отправьте приглашение из раздела практики");

  let [search] = await db.select().from(searchProfiles).where(and(
    eq(searchProfiles.companyId, company.id),
    eq(searchProfiles.professionId, specialist.professionId),
    isNull(searchProfiles.deletedAt),
  )).limit(1);

  if (!search) {
    const skillIds = specialist.skills.map(skill => skill.id);
    if (!skillIds.length) {
      const [firstSkill] = await db.select({ id: skills.id }).from(skills).limit(1);
      if (firstSkill) skillIds.push(firstSkill.id);
    }
    if (!skillIds.length) fail(409, "NO_SKILLS", "Добавьте навыки в каталог, чтобы отправить заявку");
    const salaryMinRub = specialist.salaryMinRub ?? 80_000;
    const salaryMaxRub = Math.max(specialist.salaryMaxRub ?? 160_000, salaryMinRub);
    const [created] = await db.insert(searchProfiles).values({
      companyId: company.id,
      title: `${specialist.profession} · отклик на профиль`,
      professionId: specialist.professionId,
      targetLevel: specialist.level ?? "MIDDLE",
      minimumExperience: specialist.experience ?? "NONE",
      salaryMinRub,
      salaryMaxRub,
      workFormat: specialist.workFormat ?? company.workFormat,
      employmentType: specialist.employmentType ?? "FULL_TIME",
    }).returning();
    search = created;
    await db.insert(searchProfileSkills).values(skillIds.map(skillId => ({ searchProfileId: created.id, skillId })));
  }

  const positionTitle = search.title;
  const offer = await createOffer(employerUserId, {
    specialistUserId,
    searchProfileId: search.id,
    positionTitle,
    salaryMinRub: search.salaryMinRub,
    salaryMaxRub: search.salaryMaxRub,
    description: `Команда ${company.name} заинтересовалась вашим профилем ${specialist.profession}. Предлагаем обсудить задачи и условия сотрудничества.`,
    workFormat: search.workFormat,
    employmentType: search.employmentType,
    message: `Здравствуйте, ${specialist.firstName}! Ваш профиль заинтересовал команду ${company.name}. Будем рады обсудить с вами роль «${positionTitle}».`,
  });
  return { offerId: offer.id, status: offer.status };
}
