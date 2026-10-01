import { db, pool } from "../src/db/client";
import { cities, companies, companySocialLinks, mediaFiles, offers, professions, searchProfiles, searchProfileSkills, skills, specialistProfiles, specialistSkills, user } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { auth, withRegistrationRole, type Role } from "../src/server/auth/auth";
import { localFileStorage } from "../src/server/storage/local";
import { createOffer } from "../src/server/offers/service";

if (process.env.SEED_DEMO_DATA !== "true") { console.log("Demo seed skipped (SEED_DEMO_DATA=false)"); process.exit(0); }
const password = "DemoPass123!";
const avatarBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
async function catalog(table: typeof professions | typeof cities | typeof skills, names: string[]) { for (const [sortOrder,name] of names.entries()) await db.insert(table).values({ name, normalizedName: name.toLowerCase(), sortOrder }).onConflictDoNothing(); return db.select().from(table); }
async function ensureAccount(email: string, role: Role) { const [existing] = await db.select().from(user).where(eq(user.email, email)); if (existing) { if (existing.role !== role) throw new Error(`Wrong role for ${email}`); return existing; } await withRegistrationRole(role, () => auth.api.signUpEmail({ body: { email, password, name: "Demo user" } })); const [created] = await db.select().from(user).where(eq(user.email, email)); if (!created) throw new Error(`Could not create ${email}`); return created; }
async function media(ownerUserId: string, kind: "AVATAR" | "COMPANY_LOGO") { const storageKey = await localFileStorage.save(avatarBytes); const [file] = await db.insert(mediaFiles).values({ ownerUserId, kind, storageKey, mimeType: "image/png", byteSize: avatarBytes.length }).returning(); return file.id; }
async function main() {
  const allProfessions = await catalog(professions, ["Frontend-разработчик", "Backend-разработчик", "Fullstack-разработчик", "UI/UX Designer", "DevOps-инженер", "Data Scientist"]);
  const allCities = await catalog(cities, ["Москва", "Санкт-Петербург", "Казань", "Новосибирск", "Екатеринбург", "Самара", "Краснодар", "Томск"]);
  const allSkills = await catalog(skills, ["React", "JavaScript", "TypeScript", "Python", "Figma", "Git", "Node.js", "PostgreSQL", "Docker", "Go", "Kubernetes", "Next.js", "SQL", "UI Research", "CSS"]);
  const firstNames = ["Алексей","Мария","Илья","Алина","Дмитрий","София","Максим","Анна","Павел","Екатерина","Никита","Полина","Артём","Дарья","Кирилл","Ольга","Роман","Виктория","Тимур","Елена"];
  const lastNames = ["Петров","Соколова","Морозов","Волкова","Кузнецов","Орлова","Смирнов","Иванова","Попов","Крылова","Васильев","Лебедева","Федоров","Николаева","Андреев","Павлова","Романов","Зайцева","Белов","Миронова"];
  const specialistIds: string[] = [];
  for (let i=0;i<20;i++) {
    const account = await ensureAccount(`specialist${i+1}@demo.mtch.test`, "SPECIALIST"); specialistIds.push(account.id);
    const [existing] = await db.select({ id: specialistProfiles.userId }).from(specialistProfiles).where(eq(specialistProfiles.userId, account.id)); if (existing) continue;
    const avatarFileId = await media(account.id, "AVATAR"); const profession = allProfessions[i%allProfessions.length]; const chosen = [allSkills[i%allSkills.length],allSkills[(i+1)%allSkills.length],allSkills[(i+5)%allSkills.length]];
    await db.insert(specialistProfiles).values({ userId: account.id, firstName: firstNames[i], lastName: lastNames[i], birthDate: `${1988+i%12}-05-12`, cityId: allCities[i%allCities.length].id, avatarFileId, professionId: profession.id, experience: ["UNDER_1","FROM_1_TO_3","FROM_3_TO_5","OVER_5"][i%4] as "UNDER_1"|"FROM_1_TO_3"|"FROM_3_TO_5"|"OVER_5", level: ["JUNIOR","MIDDLE","SENIOR","INTERN"][i%4] as "JUNIOR"|"MIDDLE"|"SENIOR"|"INTERN", cooperationType: "STAFF", about: `Вымышленный специалист ${i+1} для демонстрации mtch.`, salaryMinRub: 60000+i*7000, salaryMaxRub: 100000+i*9000, workFormat: ["REMOTE","HYBRID","OFFICE"][i%3] as "REMOTE"|"HYBRID"|"OFFICE", employmentType: "FULL_TIME", searchStatus: i===19 ? "NOT_LOOKING" : i%3===0 ? "ACTIVE" : "OPEN_TO_OFFERS", telegram: `@demo_specialist_${i+1}` });
    await db.insert(specialistSkills).values(chosen.map(skill=>({ specialistUserId: account.id, skillId: skill.id })));
  }
  const employers: string[] = [];
  for (let i=0;i<4;i++) {
    const employer = await ensureAccount(`employer${i+1}@demo.mtch.test`, "EMPLOYER"); employers.push(employer.id);
    let [company] = await db.select().from(companies).where(eq(companies.ownerUserId, employer.id));
    if (!company) { const logoFileId = await media(employer.id, "COMPANY_LOGO"); [company] = await db.insert(companies).values({ ownerUserId: employer.id, name: ["Кодовая лаборатория","Пиксельные системы","Данные и продукты","Облачные решения"][i], description: `Вымышленная ИТ-компания ${i+1} для демонстрации.`, workFormat: ["REMOTE","HYBRID","OFFICE","REMOTE"][i] as "REMOTE"|"HYBRID"|"OFFICE", foundedYear: 2015+i, sizeBand: ["11-50","51-200","1-10","201-1000"][i] as "11-50"|"51-200"|"1-10"|"201-1000", industry: "ИТ", logoFileId, contactEmail: `hr${i+1}@demo.mtch.test`, telegram: `@demo_company_${i+1}` }).returning(); await db.insert(companySocialLinks).values({ companyId: company.id, platform: "TELEGRAM", value: `@demo_company_${i+1}` }); }
    for (let j=0;j<2;j++) { const profession=allProfessions[(i+j)%allProfessions.length]; const title=`${profession.name} ${j===0?"Middle":"Senior"}`; let [search]=await db.select().from(searchProfiles).where(and(eq(searchProfiles.companyId,company.id),eq(searchProfiles.title,title))); if(!search){[search]=await db.insert(searchProfiles).values({companyId:company.id,title,professionId:profession.id,targetLevel:j===0?"MIDDLE":"SENIOR",minimumExperience:j===0?"FROM_1_TO_3":"FROM_3_TO_5",salaryMinRub:90000, salaryMaxRub:250000,workFormat:company.workFormat,employmentType:"FULL_TIME"}).returning();await db.insert(searchProfileSkills).values([allSkills[(i+j)%allSkills.length],allSkills[(i+j+1)%allSkills.length]].map(skill=>({searchProfileId:search.id,skillId:skill.id})));} }
  }
  for (let i=0;i<4;i++) { const [existing]=await db.select({id:offers.id}).from(offers).where(and(eq(offers.employerUserId,employers[i]),eq(offers.specialistUserId,specialistIds[i]))); if(existing)continue; const [search]=await db.select().from(searchProfiles).innerJoin(companies,eq(companies.id,searchProfiles.companyId)).where(eq(companies.ownerUserId,employers[i])); await createOffer(employers[i],{specialistUserId:specialistIds[i],searchProfileId:search.search_profiles.id,positionTitle:search.search_profiles.title,salaryMinRub:110000,salaryMaxRub:190000,description:"Вымышленное предложение для демонстрации",workFormat:search.search_profiles.workFormat,employmentType:"FULL_TIME",message:"Здравствуйте! Приглашаем вас обсудить сотрудничество."}); }
  console.log("Seed complete: 20 specialists, 4 companies, 8 search profiles, 4 offers. Demo password in README."); await pool.end();
}
main().catch(error=>{console.error(error);process.exit(1)});
