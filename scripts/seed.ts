import { db, pool } from "../src/db/client";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cities, companies, companySocialLinks, matchMessages, matches, mediaFiles, offers, practiceInvitations, practiceRecruitments, professions, searchProfiles, searchProfileSkills, skills, specialistProfiles, specialistSkills, user } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { auth, withRegistrationRole, type Role } from "../src/server/auth/auth";
import { localFileStorage } from "../src/server/storage/local";
import { deleteUnusedMedia } from "../src/server/storage/media";
import { createOffer } from "../src/server/offers/service";

if (process.env.SEED_DEMO_DATA !== "true") { console.log("Demo seed skipped (SEED_DEMO_DATA=false)"); process.exit(0); }
const password = "DemoPass123!";
const avatarBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
const demoAvatarFiles = ["01-curly-foliage.jpg", "02-glasses-curls.jpg", "03-blonde-flyaway-hair.jpg", "04-curly-beard.jpg"];
async function catalog(table: typeof professions | typeof cities | typeof skills, names: string[]) { for (const [sortOrder,name] of names.entries()) await db.insert(table).values({ name, normalizedName: name.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("ru-RU"), sortOrder }).onConflictDoNothing(); return db.select().from(table); }
async function ensureAccount(email: string, role: Role) { const [existing] = await db.select().from(user).where(eq(user.email, email)); if (existing) { if (existing.role !== role) throw new Error(`Wrong role for ${email}`); return existing; } await withRegistrationRole(role, () => auth.api.signUpEmail({ body: { email, password, name: "Demo user" } })); const [created] = await db.select().from(user).where(eq(user.email, email)); if (!created) throw new Error(`Could not create ${email}`); return created; }
async function media(ownerUserId: string, kind: "AVATAR" | "COMPANY_LOGO") { const storageKey = await localFileStorage.save(avatarBytes); const [file] = await db.insert(mediaFiles).values({ ownerUserId, kind, storageKey, mimeType: "image/png", byteSize: avatarBytes.length }).returning(); return file.id; }
async function demoAvatar(ownerUserId: string) {
  const photo = demoAvatarFiles[Math.floor(Math.random() * demoAvatarFiles.length)];
  const bytes = await readFile(join(process.cwd(), "photo-processor", "fixtures", "hair_quality", photo));
  const storageKey = await localFileStorage.save(bytes);
  try {
    const [file] = await db.insert(mediaFiles).values({ ownerUserId, kind: "AVATAR", storageKey, mimeType: "image/jpeg", byteSize: bytes.length }).returning();
    return file.id;
  } catch (error) {
    await localFileStorage.remove(storageKey);
    throw error;
  }
}
async function demoBrandLogo(ownerUserId: string, svg: string) {
  const [existing] = await db.select({ id: mediaFiles.id }).from(mediaFiles).where(and(eq(mediaFiles.ownerUserId, ownerUserId), eq(mediaFiles.kind, "COMPANY_LOGO")));
  if (existing) return existing.id;
  const bytes = Buffer.from(svg);
  const storageKey = await localFileStorage.save(bytes);
  const [file] = await db.insert(mediaFiles).values({ ownerUserId, kind: "COMPANY_LOGO", storageKey, mimeType: "image/svg+xml", byteSize: bytes.length }).returning();
  return file.id;
}
function demoBrandSvg(name: string) {
  if (name === "Яндекс") return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#fff"/><text x="64" y="94" text-anchor="middle" font-family="Arial,sans-serif" font-size="82" font-weight="700" fill="#fc3f1d">Я</text></svg>`;
  if (name === "Тинькофф") return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#17191b"/><path d="M64 13 107 30v31c0 28-17 46-43 56C38 107 21 89 21 61V30z" fill="#ffdd2d"/><path d="M39 43h50v13H70v43H57V56H39z" fill="#17191b"/></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="sber" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#00a84f"/><stop offset=".58" stop-color="#20b5a3"/><stop offset="1" stop-color="#5b8cff"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="#fff"/><circle cx="64" cy="64" r="48" fill="url(#sber)"/><path d="m38 66 17 17 36-39" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="11"/></svg>`;
}
async function main() {
  const allProfessions = await catalog(professions, ["Frontend-разработчик", "Backend-разработчик", "Fullstack-разработчик", "UI/UX Designer", "DevOps-инженер", "Data Scientist"]);
  const allCities = await catalog(cities, ["Москва", "Санкт-Петербург", "Казань", "Новосибирск", "Екатеринбург", "Самара", "Краснодар", "Томск", "Ростов-на-Дону", "Нижний Новгород", "Воронеж", "Уфа", "Пермь", "Красноярск", "Омск", "Тюмень", "Челябинск", "Саратов", "Ярославль", "Иркутск", "Владивосток", "Калининград", "Сочи", "Волгоград", "Оренбург", "Кемерово", "Новокузнецк", "Рязань", "Балашиха", "Пенза", "Липецк", "Киров", "Чебоксары", "Тула", "Ульяновск", "Барнаул", "Ижевск", "Набережные Челны", "Тольятти", "Хабаровск", "Махачкала", "Ставрополь", "Белгород", "Курск", "Севастополь", "Симферополь", "Архангельск", "Сургут", "Якутск", "Владикавказ", "Грозный", "Тверь", "Калуга", "Смоленск", "Брянск", "Владимир", "Иваново", "Кострома", "Мурманск", "Череповец", "Вологда", "Петрозаводск", "Орёл", "Тамбов", "Саранск", "Йошкар-Ола", "Элиста", "Астрахань", "Курган", "Нижний Тагил", "Магнитогорск", "Стерлитамак", "Орск", "Нижневартовск", "Ноябрьск", "Миасс", "Златоуст", "Северодвинск", "Псков", "Великий Новгород", "Гатчина", "Выборг", "Подольск", "Химки", "Королёв", "Мытищи", "Люберцы", "Одинцово", "Красногорск", "Домодедово", "Электросталь", "Коломна", "Серпухов", "Реутов", "Щёлково", "Жуковский", "Обнинск", "Березники", "Сыктывкар", "Норильск", "Братск", "Ангарск", "Чита", "Улан-Удэ", "Комсомольск-на-Амуре", "Благовещенск", "Южно-Сахалинск", "Петропавловск-Камчатский", "Магадан", "Анадырь", "Биробиджан", "Кызыл", "Абакан", "Горно-Алтайск", "Новый Уренгой", "Салехард", "Ханты-Мансийск", "Нефтеюганск", "Шахты", "Таганрог", "Азов", "Батайск", "Новочеркасск", "Каменск-Шахтинский", "Энгельс", "Балаково", "Дзержинск", "Арзамас", "Саров", "Прокопьевск", "Рубцовск", "Бийск", "Димитровград", "Камышин", "Волжский", "Копейск", "Первоуральск", "Каменск-Уральский", "Междуреченск", "Находка", "Уссурийск", "Артём", "Елец", "Старый Оскол", "Губкин", "Минск", "Алматы", "Астана", "Ташкент", "Ереван", "Тбилиси", "Баку"]);
  const allSkills = await catalog(skills, ["React", "JavaScript", "TypeScript", "Python", "Figma", "Git", "Node.js", "PostgreSQL", "Docker", "Go", "Kubernetes", "Next.js", "SQL", "UI Research", "CSS", "FastAPI", "HTML", "Tailwind CSS", "Bootstrap", "Vue.js", "Angular", "Svelte", "Redux", "Zustand", "React Native", "Expo", "Vite", "Webpack", "Express.js", "NestJS", "REST API", "GraphQL", "Jest", "Vitest", "Playwright", "Cypress", "Django", "Flask", "Java", "Spring Boot", "Kotlin", "Swift", "C#", ".NET", "C++", "PHP", "Laravel", "Ruby", "Ruby on Rails", "Rust", "MySQL", "MongoDB", "Redis", "ClickHouse", "SQLite", "Prisma", "Drizzle ORM", "Pandas", "NumPy", "TensorFlow", "PyTorch", "Scikit-learn", "AWS", "Yandex Cloud", "Azure", "Terraform", "Ansible", "CI/CD", "Linux", "Bash", "Photoshop", "Illustrator", "Adobe XD", "After Effects", "Premiere Pro", "InDesign", "Lightroom", "Blender", "Sketch", "CorelDRAW", "Canva", "Procreate", "Motion design", "UI/UX", "Typography", "Unity", "Unreal Engine", "1C", "SEO", "Google Analytics", "Microsoft Excel"]);
  const firstNames = ["Алексей","Мария","Илья","Алина","Дмитрий","София","Максим","Анна","Павел","Екатерина","Никита","Полина","Артём","Дарья","Кирилл","Ольга","Роман","Виктория","Тимур","Елена"];
  const lastNames = ["Петров","Соколова","Морозов","Волкова","Кузнецов","Орлова","Смирнов","Иванова","Попов","Крылова","Васильев","Лебедева","Федоров","Николаева","Андреев","Павлова","Романов","Зайцева","Белов","Миронова"];
  const demoSkillsByProfession: Record<string, string[]> = {
    "Frontend-разработчик": ["React", "TypeScript", "JavaScript", "Next.js", "CSS", "Git", "Figma"],
    "Backend-разработчик": ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "Git", "SQL"],
    "Fullstack-разработчик": ["JavaScript", "TypeScript", "React", "Node.js", "PostgreSQL", "Docker", "Git"],
    "UI/UX Designer": ["Figma", "Photoshop", "Illustrator", "UI/UX", "UI Research", "Typography", "Sketch"],
    "DevOps-инженер": ["Linux", "Docker", "Kubernetes", "Terraform", "CI/CD", "Bash", "AWS"],
    "Data Scientist": ["Python", "SQL", "Pandas", "NumPy", "Scikit-learn", "PostgreSQL", "Git"],
  };
  const aboutByProfession: Record<string, string[]> = {
    "Frontend-разработчик": ["Создаю быстрые и доступные веб-интерфейсы, превращаю макеты в аккуратные компоненты и слежу за деталями пользовательского опыта.", "Развиваю интерфейсы на React и TypeScript: от адаптивной вёрстки до интеграции с API и тестирования основных сценариев."],
    "Backend-разработчик": ["Проектирую API и сервисы, работаю с базами данных и очередями. Люблю понятную архитектуру, наблюдаемость и предсказуемую работу приложений.", "Разрабатываю серверную логику на Python, оптимизирую запросы и помогаю команде поддерживать надёжные интеграции."],
    "Fullstack-разработчик": ["Работаю на стыке интерфейса и серверной части: собираю сценарии целиком и стараюсь, чтобы продукт оставался простым для пользователя.", "Создаю веб-приложения от схемы данных и API до адаптивного интерфейса. Предпочитаю небольшие итерации и понятные решения."],
    "UI/UX Designer": ["Исследую задачи пользователей и собираю интерфейсы в Figma: от структуры и прототипа до дизайн-системы и передачи в разработку.", "Проектирую цифровые продукты, проверяю гипотезы прототипами и внимательно отношусь к типографике, состояниям и доступности."],
    "DevOps-инженер": ["Автоматизирую сборку и доставку приложений, настраиваю инфраструктуру как код и помогаю командам увереннее выпускать изменения.", "Занимаюсь контейнеризацией, мониторингом и CI/CD. В работе ценю воспроизводимые окружения и понятные инструкции."],
    "Data Scientist": ["Готовлю данные, проверяю гипотезы и строю модели, которые помогают командам принимать решения на основе измеримых результатов.", "Исследую данные на Python, документирую эксперименты и думаю о том, как безопасно встроить модель в продуктовый процесс."],
  };
  const studyPrograms: Record<string, string> = {
    "Frontend-разработчик": "Информационные системы и веб-разработка",
    "Backend-разработчик": "Программная инженерия и серверные системы",
    "Fullstack-разработчик": "Разработка и сопровождение веб-приложений",
    "UI/UX Designer": "Цифровой дизайн и проектирование интерфейсов",
    "DevOps-инженер": "Облачные вычисления и администрирование систем",
    "Data Scientist": "Прикладная математика и анализ данных",
  };
  const specialistIds: string[] = [];
  for (let i=0;i<20;i++) {
    const account = await ensureAccount(`specialist${i+1}@demo.mtch.test`, "SPECIALIST"); specialistIds.push(account.id);
    const [existing] = await db.select({ id: specialistProfiles.userId, avatarFileId: specialistProfiles.avatarFileId, employmentGoal: specialistProfiles.employmentGoal }).from(specialistProfiles).where(eq(specialistProfiles.userId, account.id));
    let avatarFileId: string;
    let staleAvatarId: string | null = null;
    if (existing) {
      const [currentAvatar] = await db.select({ id: mediaFiles.id, mimeType: mediaFiles.mimeType, byteSize: mediaFiles.byteSize }).from(mediaFiles).where(eq(mediaFiles.id, existing.avatarFileId));
      avatarFileId = existing.avatarFileId;
      if (currentAvatar?.mimeType === "image/png" && currentAvatar.byteSize === avatarBytes.length) {
        avatarFileId = await demoAvatar(account.id);
        staleAvatarId = currentAvatar.id;
      }
    } else avatarFileId = await demoAvatar(account.id);
    const profession = allProfessions[i%allProfessions.length];
    const skillNames = demoSkillsByProfession[profession.name];
    const chosen = skillNames.map(name => allSkills.find(skill => skill.name === name)!);
    const demoAge = 21+i%11;
    const profileValues = {
      firstName: firstNames[i], lastName: lastNames[i], birthDate: `${new Date().getFullYear()-demoAge}-05-12`, age: demoAge, cityId: allCities[i%allCities.length].id, avatarFileId, professionId: profession.id,
      experience: ["UNDER_1","FROM_1_TO_3","FROM_3_TO_5","OVER_5"][i%4] as "UNDER_1"|"FROM_1_TO_3"|"FROM_3_TO_5"|"OVER_5",
      level: ["JUNIOR","MIDDLE","SENIOR","INTERN"][i%4] as "JUNIOR"|"MIDDLE"|"SENIOR"|"INTERN", cooperationType: "STAFF" as const,
      about: `${aboutByProfession[profession.name][i%2]} В демонстрационном профиле ${i+1} указана готовность обсудить задачи, формат работы и ожидания команды.`,
      portfolioUrl: `https://portfolio-demo-${i+1}.example`, githubUrl: `https://github.com/demo-specialist-${i+1}`,
      behanceGitlabUrl: profession.name === "UI/UX Designer" ? `https://behance.net/demo-designer-${i+1}` : `https://gitlab.com/demo-specialist-${i+1}`,
      salaryMinRub: existing?.employmentGoal === "PRACTICE" ? null : 60000+i*7000, salaryMaxRub: existing?.employmentGoal === "PRACTICE" ? null : 100000+i*9000,
      workFormat: ["REMOTE","HYBRID","OFFICE"][i%3] as "REMOTE"|"HYBRID"|"OFFICE", employmentType: "FULL_TIME" as const,
      searchStatus: i===19 ? "NOT_LOOKING" as const : i%3===0 ? "ACTIVE" as const : "OPEN_TO_OFFERS" as const,
      educationalInstitution: ["Демо-университет цифровых технологий", "Демо-колледж прикладной информатики", "Демо-институт разработки и дизайна"][i%3],
      educationProgram: studyPrograms[profession.name], telegram: `@demo_specialist_${i+1}`, updatedAt: new Date(),
    };
    if (existing) await db.update(specialistProfiles).set(profileValues).where(eq(specialistProfiles.userId, account.id));
    else await db.insert(specialistProfiles).values({ ...profileValues, userId: account.id });
    if (staleAvatarId) await deleteUnusedMedia(account.id, staleAvatarId);
    await db.delete(specialistSkills).where(eq(specialistSkills.specialistUserId, account.id));
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
  const demoEmployerId = employers[0];
  const activeCandidateId = specialistIds[0];
  const [activeOffer] = await db.select().from(offers).where(and(eq(offers.employerUserId, demoEmployerId), eq(offers.specialistUserId, activeCandidateId))).limit(1);
  if (activeOffer?.status === "SENT") {
    await db.update(offers).set({ status: "ACCEPTED", resolvedAt: new Date() }).where(eq(offers.id, activeOffer.id));
  }
  if (activeOffer?.status === "ACCEPTED" || activeOffer?.status === "SENT") {
    let [activeMatch] = await db.select().from(matches).where(eq(matches.offerId, activeOffer.id)).limit(1);
    if (!activeMatch) [activeMatch] = await db.insert(matches).values({ offerId: activeOffer.id, employerUserId: demoEmployerId, specialistUserId: activeCandidateId, companyId: activeOffer.companyId }).returning();
    const [firstMessage] = await db.select({ id: matchMessages.id }).from(matchMessages).where(eq(matchMessages.matchId, activeMatch.id)).limit(1);
    if (!firstMessage) await db.insert(matchMessages).values({ matchId: activeMatch.id, senderUserId: demoEmployerId, body: "Здравствуйте! Спасибо, что приняли предложение. Расскажите, пожалуйста, над какими задачами вам интереснее всего работать?" });
  }
  const waitingCandidateId = specialistIds[2];
  const [waitingOffer] = await db.select({ id: offers.id }).from(offers).where(and(eq(offers.employerUserId, demoEmployerId), eq(offers.specialistUserId, waitingCandidateId), eq(offers.status, "SENT"))).limit(1);
  if (!waitingOffer) {
    const [company] = await db.select().from(companies).where(eq(companies.ownerUserId, demoEmployerId));
    const [search] = await db.select().from(searchProfiles).where(eq(searchProfiles.companyId, company.id)).limit(1);
    const [priorOffer] = await db.select({ status: offers.status }).from(offers).where(and(eq(offers.employerUserId, demoEmployerId), eq(offers.specialistUserId, waitingCandidateId))).limit(1);
    if (!priorOffer && search) await createOffer(demoEmployerId, { specialistUserId: waitingCandidateId, searchProfileId: search.id, positionTitle: "Fullstack-разработчик · демо-приглашение", salaryMinRub: 120000, salaryMaxRub: 210000, description: "Демонстрационное предложение для просмотра состояния ожидания подтверждения.", workFormat: search.workFormat, employmentType: "FULL_TIME", message: "Здравствуйте! Ваш профиль заинтересовал нашу команду. Предлагаем обсудить подходящую роль и условия." });
  }
  const demoSpecialistId = specialistIds[18];
  const demoSkillNames = ["React", "JavaScript", "TypeScript", "Next.js", "CSS", "Git"];
  await db.insert(specialistSkills).values(demoSkillNames.map(name => ({ specialistUserId: demoSpecialistId, skillId: allSkills.find(skill => skill.name === name)!.id }))).onConflictDoNothing();
  const frontend = allProfessions.find(item => item.name === "Frontend-разработчик")!;
  const demoOffers = [
    {
      email: "demo.yandex@demo.mtch.test", name: "Яндекс", description: "Демонстрационный профиль продуктовой IT-команды. Пример описания компании для ленты mtch.", industry: "Интернет-технологии", foundedYear: 2000, sizeBand: "1000+" as const, workFormat: "HYBRID" as const, websiteUrl: "https://yandex.ru",
      positionTitle: "Frontend-разработчик — продуктовые сервисы", salaryMinRub: 200000, salaryMaxRub: 280000, skills: ["React", "TypeScript", "JavaScript", "Next.js", "CSS"],
      message: "Демо-приглашение: ваш опыт с React и TypeScript может подойти продуктовой команде. Предлагаем обсудить интерфейсы, задачи и условия.",
      details: "Это демонстрационное предложение mtch., а не реальная вакансия или официальное приглашение Яндекса.\n\nКоманда развивает пользовательские интерфейсы цифровых сервисов. В этой роли вы будете создавать адаптивные страницы и компоненты, участвовать в обсуждении решений вместе с дизайнерами и аналитиками, следить за производительностью и доступностью интерфейсов.\n\nОжидаем уверенное владение JavaScript и TypeScript, практический опыт с React, понимание HTML и CSS, работу с Git и готовность разбираться в существующем коде. Будет плюсом опыт с Next.js, тестами компонентов и дизайн-системами.\n\nФормат в этом примере — гибридный, полная занятость. Диапазон указан до вычета налогов и приведён для демонстрации карточки.",
    },
    {
      email: "demo.tinkoff@demo.mtch.test", name: "Тинькофф", description: "Демонстрационный профиль финтех-команды. Пример информации о работодателе для mtch.", industry: "Финтех", foundedYear: 2006, sizeBand: "1000+" as const, workFormat: "REMOTE" as const, websiteUrl: "https://www.tbank.ru",
      positionTitle: "Frontend-разработчик — веб-продукты", salaryMinRub: 190000, salaryMaxRub: 270000, skills: ["React", "TypeScript", "JavaScript", "Redux", "Jest"],
      message: "Демо-приглашение: приглашаем обсудить разработку веб-интерфейсов финансовых продуктов на React и TypeScript.",
      details: "Это демонстрационное предложение mtch., оно не размещено Тинькофф и не является официальным приглашением компании.\n\nПример роли в продуктовой финтех-команде: развивать личный кабинет и пользовательские сценарии, собирать переиспользуемые компоненты, покрывать важную логику тестами и работать вместе с дизайнерами, аналитиками и backend-разработчиками.\n\nВ примере требуются React, TypeScript, JavaScript, HTML/CSS, Git и понимание работы клиентских приложений. Плюсом будут опыт с Redux, Jest, Storybook и внимание к скорости загрузки и качеству интерфейса.\n\nПредложены удалённый формат и полная занятость. Зарплатный диапазон демонстрационный и обсуждается в зависимости от опыта.",
    },
    {
      email: "demo.sber@demo.mtch.test", name: "Сбербанк", description: "Демонстрационный профиль цифровой финансовой команды. Не связан с подбором сотрудников Сбера.", industry: "Финансовые технологии", foundedYear: 1991, sizeBand: "1000+" as const, workFormat: "HYBRID" as const, websiteUrl: "https://www.sberbank.ru",
      positionTitle: "Frontend-инженер — цифровые сервисы", salaryMinRub: 180000, salaryMaxRub: 260000, skills: ["React", "TypeScript", "JavaScript", "Node.js", "GraphQL"],
      message: "Демо-приглашение: рассмотрите пример роли frontend-инженера в команде цифровых сервисов и финансовых продуктов.",
      details: "Это демонстрационное предложение для проверки интерфейса mtch., не настоящая вакансия и не официальное обращение Сбербанка.\n\nПример задач: разрабатывать клиентские части цифровых сервисов, превращать макеты в понятные адаптивные интерфейсы, интегрировать их с API и участвовать в улучшении компонентов и инструментов команды.\n\nБазовый набор для примера — React, TypeScript, JavaScript, HTML/CSS и Git. Будут полезны знакомство с Node.js, GraphQL, автоматизированными тестами и практиками командной разработки.\n\nУказаны гибридный формат, полная занятость и ориентировочный диапазон оплаты до вычета налогов. Все условия в этой карточке придуманы для демонстрации продукта.",
    },
  ];
  for (const demo of demoOffers) {
    const employer = await ensureAccount(demo.email, "EMPLOYER");
    let [company] = await db.select().from(companies).where(eq(companies.ownerUserId, employer.id));
    if (!company) {
      const logoFileId = await demoBrandLogo(employer.id, demoBrandSvg(demo.name));
      [company] = await db.insert(companies).values({ ownerUserId: employer.id, name: demo.name, description: demo.description, industry: demo.industry, foundedYear: demo.foundedYear, sizeBand: demo.sizeBand, workFormat: demo.workFormat, websiteUrl: demo.websiteUrl, logoFileId, contactEmail: `hr@${demo.email.replace("@demo.mtch.test", ".demo.mtch.test")}`, telegram: `@demo_${demo.email.split("@")[0].replaceAll(".", "_")}` }).returning();
    }
    const title = `Демо · ${demo.positionTitle}`;
    let [search] = await db.select().from(searchProfiles).where(and(eq(searchProfiles.companyId, company.id), eq(searchProfiles.title, title)));
    if (!search) {
      [search] = await db.insert(searchProfiles).values({ companyId: company.id, title, professionId: frontend.id, targetLevel: "MIDDLE", minimumExperience: "FROM_1_TO_3", salaryMinRub: demo.salaryMinRub, salaryMaxRub: demo.salaryMaxRub, workFormat: demo.workFormat, employmentType: "FULL_TIME" }).returning();
    }
    await db.insert(searchProfileSkills).values(demo.skills.map(name => ({ searchProfileId: search.id, skillId: allSkills.find(skill => skill.name === name)!.id }))).onConflictDoNothing();
    const [existingOffer] = await db.select({ id: offers.id }).from(offers).where(and(eq(offers.employerUserId, employer.id), eq(offers.specialistUserId, demoSpecialistId))).limit(1);
    if (!existingOffer) await createOffer(employer.id, { specialistUserId: demoSpecialistId, searchProfileId: search.id, positionTitle: demo.positionTitle, salaryMinRub: demo.salaryMinRub, salaryMaxRub: demo.salaryMaxRub, description: demo.details, workFormat: demo.workFormat, employmentType: "FULL_TIME", message: demo.message });
  }
  const practiceDirections = ["backend", "frontend", "qa"];
  for (let i=4;i<17;i++) {
    await db.update(specialistProfiles).set({ employmentGoal: "PRACTICE", salaryMinRub: null, salaryMaxRub: null, firstName: i===6 ? "Алексей" : firstNames[i], lastName: i===6 ? "Иванов" : lastNames[i],
      educationalInstitution: i===6 || i%2 ? "РКСИ" : "Технический колледж", educationProgram: "09.02.07 Информационные системы и программирование", studyCourse: 2+i%4,
      practiceStartDate: "2027-03-01", practiceEndDate: "2027-04-30", desiredDirections: [practiceDirections[i%3]], practiceWorkFormats: i%3===0 ? ["REMOTE"] : ["REMOTE", "HYBRID"],
    }).where(eq(specialistProfiles.userId, specialistIds[i]));
  }
  await db.insert(specialistSkills).values(["Python", "SQL", "Git", "FastAPI", "Docker", "PostgreSQL"].map(name=>({specialistUserId:specialistIds[6],skillId:allSkills.find(skill=>skill.name===name)!.id}))).onConflictDoNothing();
  for (let i=0;i<3;i++) {
    const [company] = await db.select().from(companies).where(eq(companies.ownerUserId, employers[i]));
    const title = `${["Backend", "Frontend", "QA"][i]} / производственная практика`;
    const [existing] = await db.select({ id: practiceRecruitments.id }).from(practiceRecruitments).where(and(eq(practiceRecruitments.companyId, company.id), eq(practiceRecruitments.title, title)));
    const requiredNames=i===0?["Python","SQL","Git"]:i===1?["React","TypeScript"]:["Git","SQL"];
    const optionalNames=i===0?["FastAPI","Docker"]:i===1?["Next.js"]:["Docker"];
    const requiredSkillIds=requiredNames.map(name=>allSkills.find(x=>x.name===name)!.id);
    const optionalSkillIds=optionalNames.map(name=>allSkills.find(x=>x.name===name)!.id);
    if (!existing) await db.insert(practiceRecruitments).values({ employerUserId: employers[i], companyId: company.id, title, description: "Вымышленный набор для демонстрации практики", direction: practiceDirections[i], slotsTotal: 5, practiceStartDate: "2027-03-01", practiceEndDate: "2027-04-30", workFormats: ["REMOTE", "HYBRID"], cityId: company.workFormat === "REMOTE" ? null : allCities[i].id, requiredSkillIds, optionalSkillIds, studyCourseMin: 2, studyCourseMax: 6, officialPracticeSupport: true, status: "ACTIVE" });
    else { const invitations=await db.select({id:practiceInvitations.id}).from(practiceInvitations).where(eq(practiceInvitations.practiceRecruitmentId,existing.id)); if(invitations.length===0) await db.update(practiceRecruitments).set({requiredSkillIds,optionalSkillIds}).where(eq(practiceRecruitments.id,existing.id)); }
  }
  console.log("Seed complete: 20 specialists (13 practice), 7 companies (3 brand demos), 11 search profiles, 8 job offers including one active and one waiting chat for employer1, and 3 practice recruitments. Demo password in README."); await pool.end();
}
main().catch(error=>{console.error(error);process.exit(1)});
