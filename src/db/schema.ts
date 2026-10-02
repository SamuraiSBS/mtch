import { pgTable, pgEnum, text, varchar, boolean, integer, timestamp, date, uuid, primaryKey, uniqueIndex, index, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("user_role", ["SPECIALIST", "EMPLOYER"]);
export const experienceEnum = pgEnum("experience", ["NONE", "UNDER_1", "FROM_1_TO_3", "FROM_3_TO_5", "OVER_5"]);
export const levelEnum = pgEnum("level", ["INTERN", "JUNIOR", "MIDDLE", "SENIOR"]);
export const cooperationEnum = pgEnum("cooperation_type", ["STAFF", "PROJECT", "FREELANCE", "INTERNSHIP"]);
export const workFormatEnum = pgEnum("work_format", ["REMOTE", "HYBRID", "OFFICE"]);
export const employmentEnum = pgEnum("employment_type", ["FULL_TIME", "PART_TIME", "PROJECT", "INTERNSHIP"]);
export const searchStatusEnum = pgEnum("search_status", ["ACTIVE", "OPEN_TO_OFFERS", "NOT_LOOKING"]);
export const employmentGoalEnum = pgEnum("employment_goal", ["JOB", "INTERNSHIP", "PRACTICE", "OPEN_TO_OFFERS"]);
export const practiceStatusEnum = pgEnum("practice_status", ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]);
export const practiceInvitationStatusEnum = pgEnum("practice_invitation_status", ["SENT", "VIEWED", "ACCEPTED", "DECLINED", "INTERVIEW", "HIRED"]);
export const offerStatusEnum = pgEnum("offer_status", ["SENT", "ACCEPTED", "REJECTED", "WITHDRAWN"]);
export const mediaKindEnum = pgEnum("media_kind", ["AVATAR", "COMPANY_LOGO", "COMPANY_PHOTO"]);
export const socialPlatformEnum = pgEnum("social_platform", ["TELEGRAM", "INSTAGRAM", "TIKTOK", "OTHER"]);
export const sizeBandEnum = pgEnum("size_band", ["1-10", "11-50", "51-200", "201-1000", "1000+"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  role: roleEnum("role").notNull(),
});
export const session = pgTable("session", {
  id: text("id").primaryKey(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, t => [index("session_user_idx").on(t.userId), index("session_expiry_idx").on(t.expiresAt)]);
export const account = pgTable("account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }), refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"), password: text("password"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("account_user_idx").on(t.userId)]);
export const verification = pgTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const catalogFields = () => ({ id: uuid("id").primaryKey().defaultRandom(), name: varchar("name", { length: 120 }).notNull(), normalizedName: varchar("normalized_name", { length: 120 }).notNull().unique(), sortOrder: integer("sort_order").notNull().default(0), isActive: boolean("is_active").notNull().default(true) });
export const professions = pgTable("professions", catalogFields());
export const cities = pgTable("cities", catalogFields());
export const skills = pgTable("skills", catalogFields());

export const mediaFiles = pgTable("media_files", {
  id: uuid("id").primaryKey().defaultRandom(), ownerUserId: text("owner_user_id").notNull().references(() => user.id), kind: mediaKindEnum("kind").notNull(),
  storageKey: text("storage_key").notNull().unique(), mimeType: varchar("mime_type", { length: 80 }).notNull(), byteSize: integer("byte_size").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("media_owner_idx").on(t.ownerUserId)]);
export const avatarAssets = pgTable("avatar_assets", {
  fileId: uuid("file_id").primaryKey().references(() => mediaFiles.id, { onDelete: "cascade" }),
  originalStorageKey: text("original_storage_key").notNull().unique(),
  mediumStorageKey: text("medium_storage_key").notNull().unique(),
  smallStorageKey: text("small_storage_key").notNull().unique(),
  originalMimeType: varchar("original_mime_type", { length: 80 }).notNull(),
});
export const specialistProfiles = pgTable("specialist_profiles", {
  userId: text("user_id").primaryKey().references(() => user.id), firstName: varchar("first_name", { length: 100 }).notNull(), lastName: varchar("last_name", { length: 100 }).notNull(),
  birthDate: date("birth_date"), cityId: uuid("city_id").references(() => cities.id), avatarFileId: uuid("avatar_file_id").notNull().references(() => mediaFiles.id),
  professionId: uuid("profession_id").notNull().references(() => professions.id), experience: experienceEnum("experience"), level: levelEnum("level"), cooperationType: cooperationEnum("cooperation_type"),
  about: varchar("about", { length: 500 }), portfolioUrl: text("portfolio_url"), githubUrl: text("github_url"), behanceGitlabUrl: text("behance_gitlab_url"), telegram: text("telegram"),
  resumeFileId: uuid("resume_file_id"), salaryMinRub: integer("salary_min_rub"), salaryMaxRub: integer("salary_max_rub"),
  workFormat: workFormatEnum("work_format"), employmentType: employmentEnum("employment_type"), searchStatus: searchStatusEnum("search_status").notNull().default("OPEN_TO_OFFERS"),
  employmentGoal: employmentGoalEnum("employment_goal").notNull().default("OPEN_TO_OFFERS"),
  educationalInstitution: varchar("educational_institution", { length: 200 }), educationProgram: varchar("education_program", { length: 200 }), studyCourse: integer("study_course"),
  practiceStartDate: date("practice_start_date"), practiceEndDate: date("practice_end_date"), desiredDirections: text("desired_directions").array(), practiceWorkFormats: text("practice_work_formats").array(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("specialist_feed_idx").on(t.searchStatus, t.professionId, t.level, t.experience, t.workFormat, t.cityId), check("specialist_salary_check", sql`(${t.employmentGoal} = 'PRACTICE' and ${t.salaryMinRub} is null and ${t.salaryMaxRub} is null) or (${t.employmentGoal} <> 'PRACTICE' and ${t.salaryMinRub} > 0 and ${t.salaryMaxRub} >= ${t.salaryMinRub})`), check("specialist_practice_dates_check", sql`${t.practiceStartDate} is null or ${t.practiceEndDate} > ${t.practiceStartDate}`)]);
export const specialistSkills = pgTable("specialist_skills", { specialistUserId: text("specialist_user_id").notNull().references(() => specialistProfiles.userId), skillId: uuid("skill_id").notNull().references(() => skills.id) }, t => [primaryKey({ columns: [t.specialistUserId, t.skillId] }), index("specialist_skill_idx").on(t.skillId)]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(), ownerUserId: text("owner_user_id").notNull().unique().references(() => user.id), name: varchar("name", { length: 160 }).notNull(), description: varchar("description", { length: 500 }).notNull(), workFormat: workFormatEnum("work_format").notNull(),
  foundedYear: integer("founded_year").notNull(), sizeBand: sizeBandEnum("size_band").notNull(), industry: varchar("industry", { length: 120 }).notNull(), websiteUrl: text("website_url"),
  logoFileId: uuid("logo_file_id").notNull().references(() => mediaFiles.id), contactEmail: text("contact_email"), telegram: text("telegram"), phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [check("company_founded_year_check", sql`${t.foundedYear} >= 1800`) ]);
export const companyPhotos = pgTable("company_photos", { id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id), fileId: uuid("file_id").notNull().unique().references(() => mediaFiles.id), sortOrder: integer("sort_order").notNull().default(0), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const companySocialLinks = pgTable("company_social_links", { id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id), platform: socialPlatformEnum("platform").notNull(), value: text("value").notNull(), sortOrder: integer("sort_order").notNull().default(0), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() }, t => [uniqueIndex("company_social_unique").on(t.companyId, t.platform, t.value)]);

export const searchProfiles = pgTable("search_profiles", {
  id: uuid("id").primaryKey().defaultRandom(), companyId: uuid("company_id").notNull().references(() => companies.id), title: varchar("title", { length: 160 }).notNull(), professionId: uuid("profession_id").notNull().references(() => professions.id),
  targetLevel: levelEnum("target_level").notNull(), minimumExperience: experienceEnum("minimum_experience").notNull(), salaryMinRub: integer("salary_min_rub").notNull(), salaryMaxRub: integer("salary_max_rub").notNull(), workFormat: workFormatEnum("work_format").notNull(), employmentType: employmentEnum("employment_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, t => [index("search_company_idx").on(t.companyId), check("search_salary_check", sql`${t.salaryMinRub} > 0 and ${t.salaryMaxRub} >= ${t.salaryMinRub}`)]);
export const searchProfileSkills = pgTable("search_profile_skills", { searchProfileId: uuid("search_profile_id").notNull().references(() => searchProfiles.id), skillId: uuid("skill_id").notNull().references(() => skills.id) }, t => [primaryKey({ columns: [t.searchProfileId, t.skillId] }), index("search_skill_idx").on(t.skillId)]);

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(), employerUserId: text("employer_user_id").notNull().references(() => user.id), companyId: uuid("company_id").notNull().references(() => companies.id), specialistUserId: text("specialist_user_id").notNull().references(() => user.id), searchProfileId: uuid("search_profile_id").notNull().references(() => searchProfiles.id),
  positionTitle: varchar("position_title", { length: 160 }).notNull(), salaryMinRub: integer("salary_min_rub").notNull(), salaryMaxRub: integer("salary_max_rub").notNull(), description: text("description").notNull(), workFormat: workFormatEnum("work_format").notNull(), employmentType: employmentEnum("employment_type").notNull(), message: text("message").notNull(),
  status: offerStatusEnum("status").notNull().default("SENT"), searchProfileSnapshot: jsonb("search_profile_snapshot").notNull(), specialistSnapshot: jsonb("specialist_snapshot").notNull(), companyNameSnapshot: text("company_name_snapshot").notNull(), scoreAtSend: integer("score_at_send").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(), resolvedAt: timestamp("resolved_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("offers_active_pair_unique").on(t.employerUserId, t.specialistUserId).where(sql`${t.status} in ('SENT', 'ACCEPTED')`), index("offers_incoming_idx").on(t.specialistUserId, t.sentAt), index("offers_outgoing_idx").on(t.companyId, t.sentAt), index("offers_search_idx").on(t.searchProfileId), check("offer_salary_check", sql`${t.salaryMinRub} > 0 and ${t.salaryMaxRub} >= ${t.salaryMinRub}`)]);
export const matches = pgTable("matches", { id: uuid("id").primaryKey().defaultRandom(), offerId: uuid("offer_id").notNull().unique().references(() => offers.id), employerUserId: text("employer_user_id").notNull().references(() => user.id), specialistUserId: text("specialist_user_id").notNull().references(() => user.id), companyId: uuid("company_id").notNull().references(() => companies.id), acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow() }, t => [uniqueIndex("match_pair_unique").on(t.employerUserId, t.specialistUserId)]);

export const practiceRecruitments = pgTable("practice_recruitments", {
  id: uuid("id").primaryKey().defaultRandom(), employerUserId: text("employer_user_id").notNull().references(() => user.id), companyId: uuid("company_id").notNull().references(() => companies.id),
  title: varchar("title", { length: 160 }).notNull(), description: text("description").notNull(), direction: varchar("direction", { length: 40 }).notNull(), slotsTotal: integer("slots_total").notNull(),
  practiceStartDate: date("practice_start_date").notNull(), practiceEndDate: date("practice_end_date").notNull(), workFormats: text("work_formats").array().notNull(), cityId: uuid("city_id").references(() => cities.id),
  requiredSkillIds: uuid("required_skill_ids").array().notNull(), optionalSkillIds: uuid("optional_skill_ids").array().notNull(), studyCourseMin: integer("study_course_min"), studyCourseMax: integer("study_course_max"),
  officialPracticeSupport: boolean("official_practice_support").notNull().default(false), status: practiceStatusEnum("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("practice_recruitment_company_idx").on(t.companyId, t.createdAt), check("practice_recruitment_slots_check", sql`${t.slotsTotal} > 0`), check("practice_recruitment_dates_check", sql`${t.practiceEndDate} > ${t.practiceStartDate}`)]);

export const practiceInvitations = pgTable("practice_invitations", {
  id: uuid("id").primaryKey().defaultRandom(), practiceRecruitmentId: uuid("practice_recruitment_id").notNull().references(() => practiceRecruitments.id),
  employerUserId: text("employer_user_id").notNull().references(() => user.id), candidateUserId: text("candidate_user_id").notNull().references(() => user.id),
  message: text("message").notNull(), status: practiceInvitationStatusEnum("status").notNull().default("SENT"), scoreAtSend: integer("score_at_send").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), viewedAt: timestamp("viewed_at", { withTimezone: true }), respondedAt: timestamp("responded_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex("practice_invitation_active_unique").on(t.practiceRecruitmentId, t.candidateUserId).where(sql`${t.status} in ('SENT','VIEWED','ACCEPTED','INTERVIEW','HIRED')`), index("practice_invitation_candidate_idx").on(t.candidateUserId, t.createdAt), index("practice_invitation_recruitment_idx").on(t.practiceRecruitmentId, t.createdAt)]);
