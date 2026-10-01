CREATE TYPE "public"."cooperation_type" AS ENUM('STAFF', 'PROJECT', 'FREELANCE', 'INTERNSHIP');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('FULL_TIME', 'PART_TIME', 'PROJECT', 'INTERNSHIP');--> statement-breakpoint
CREATE TYPE "public"."experience" AS ENUM('NONE', 'UNDER_1', 'FROM_1_TO_3', 'FROM_3_TO_5', 'OVER_5');--> statement-breakpoint
CREATE TYPE "public"."level" AS ENUM('INTERN', 'JUNIOR', 'MIDDLE', 'SENIOR');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('AVATAR', 'COMPANY_LOGO', 'COMPANY_PHOTO');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('SENT', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SPECIALIST', 'EMPLOYER');--> statement-breakpoint
CREATE TYPE "public"."search_status" AS ENUM('ACTIVE', 'OPEN_TO_OFFERS', 'NOT_LOOKING');--> statement-breakpoint
CREATE TYPE "public"."size_band" AS ENUM('1-10', '11-50', '51-200', '201-1000', '1000+');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('TELEGRAM', 'INSTAGRAM', 'TIKTOK', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."work_format" AS ENUM('REMOTE', 'HYBRID', 'OFFICE');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cities_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" varchar(500) NOT NULL,
	"work_format" "work_format" NOT NULL,
	"founded_year" integer NOT NULL,
	"size_band" "size_band" NOT NULL,
	"industry" varchar(120) NOT NULL,
	"website_url" text,
	"logo_file_id" uuid NOT NULL,
	"contact_email" text,
	"telegram" text,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_owner_user_id_unique" UNIQUE("owner_user_id"),
	CONSTRAINT "company_founded_year_check" CHECK ("companies"."founded_year" >= 1800)
);
--> statement-breakpoint
CREATE TABLE "company_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_photos_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
CREATE TABLE "company_social_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"employer_user_id" text NOT NULL,
	"specialist_user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_offer_id_unique" UNIQUE("offer_id")
);
--> statement-breakpoint
CREATE TABLE "media_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"kind" "media_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(80) NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"specialist_user_id" text NOT NULL,
	"search_profile_id" uuid NOT NULL,
	"position_title" varchar(160) NOT NULL,
	"salary_min_rub" integer NOT NULL,
	"salary_max_rub" integer NOT NULL,
	"description" text NOT NULL,
	"work_format" "work_format" NOT NULL,
	"employment_type" "employment_type" NOT NULL,
	"message" text NOT NULL,
	"status" "offer_status" DEFAULT 'SENT' NOT NULL,
	"search_profile_snapshot" jsonb NOT NULL,
	"specialist_snapshot" jsonb NOT NULL,
	"company_name_snapshot" text NOT NULL,
	"score_at_send" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offer_salary_check" CHECK ("offers"."salary_min_rub" > 0 and "offers"."salary_max_rub" >= "offers"."salary_min_rub")
);
--> statement-breakpoint
CREATE TABLE "professions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "professions_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "search_profile_skills" (
	"search_profile_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	CONSTRAINT "search_profile_skills_search_profile_id_skill_id_pk" PRIMARY KEY("search_profile_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "search_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"profession_id" uuid NOT NULL,
	"target_level" "level" NOT NULL,
	"minimum_experience" "experience" NOT NULL,
	"salary_min_rub" integer NOT NULL,
	"salary_max_rub" integer NOT NULL,
	"work_format" "work_format" NOT NULL,
	"employment_type" "employment_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "search_salary_check" CHECK ("search_profiles"."salary_min_rub" > 0 and "search_profiles"."salary_max_rub" >= "search_profiles"."salary_min_rub")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "skills_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "specialist_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"birth_date" date,
	"city_id" uuid,
	"avatar_file_id" uuid NOT NULL,
	"profession_id" uuid NOT NULL,
	"experience" "experience",
	"level" "level",
	"cooperation_type" "cooperation_type",
	"about" varchar(500),
	"portfolio_url" text,
	"github_url" text,
	"behance_gitlab_url" text,
	"telegram" text,
	"resume_file_id" uuid,
	"salary_min_rub" integer NOT NULL,
	"salary_max_rub" integer NOT NULL,
	"work_format" "work_format",
	"employment_type" "employment_type",
	"search_status" "search_status" DEFAULT 'OPEN_TO_OFFERS' NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "specialist_salary_check" CHECK ("specialist_profiles"."salary_min_rub" > 0 and "specialist_profiles"."salary_max_rub" >= "specialist_profiles"."salary_min_rub")
);
--> statement-breakpoint
CREATE TABLE "specialist_skills" (
	"specialist_user_id" text NOT NULL,
	"skill_id" uuid NOT NULL,
	CONSTRAINT "specialist_skills_specialist_user_id_skill_id_pk" PRIMARY KEY("specialist_user_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" "user_role" NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_logo_file_id_media_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."media_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_photos" ADD CONSTRAINT "company_photos_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_photos" ADD CONSTRAINT "company_photos_file_id_media_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_social_links" ADD CONSTRAINT "company_social_links_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_employer_user_id_user_id_fk" FOREIGN KEY ("employer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_specialist_user_id_user_id_fk" FOREIGN KEY ("specialist_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_employer_user_id_user_id_fk" FOREIGN KEY ("employer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_specialist_user_id_user_id_fk" FOREIGN KEY ("specialist_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_search_profile_id_search_profiles_id_fk" FOREIGN KEY ("search_profile_id") REFERENCES "public"."search_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_profile_skills" ADD CONSTRAINT "search_profile_skills_search_profile_id_search_profiles_id_fk" FOREIGN KEY ("search_profile_id") REFERENCES "public"."search_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_profile_skills" ADD CONSTRAINT "search_profile_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_profiles" ADD CONSTRAINT "search_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_profiles" ADD CONSTRAINT "search_profiles_profession_id_professions_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."professions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD CONSTRAINT "specialist_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD CONSTRAINT "specialist_profiles_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD CONSTRAINT "specialist_profiles_avatar_file_id_media_files_id_fk" FOREIGN KEY ("avatar_file_id") REFERENCES "public"."media_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD CONSTRAINT "specialist_profiles_profession_id_professions_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."professions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_skills" ADD CONSTRAINT "specialist_skills_specialist_user_id_specialist_profiles_user_id_fk" FOREIGN KEY ("specialist_user_id") REFERENCES "public"."specialist_profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_skills" ADD CONSTRAINT "specialist_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_social_unique" ON "company_social_links" USING btree ("company_id","platform","value");--> statement-breakpoint
CREATE UNIQUE INDEX "match_pair_unique" ON "matches" USING btree ("employer_user_id","specialist_user_id");--> statement-breakpoint
CREATE INDEX "media_owner_idx" ON "media_files" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_active_pair_unique" ON "offers" USING btree ("employer_user_id","specialist_user_id") WHERE "offers"."status" in ('SENT', 'ACCEPTED');--> statement-breakpoint
CREATE INDEX "offers_incoming_idx" ON "offers" USING btree ("specialist_user_id","sent_at");--> statement-breakpoint
CREATE INDEX "offers_outgoing_idx" ON "offers" USING btree ("company_id","sent_at");--> statement-breakpoint
CREATE INDEX "offers_search_idx" ON "offers" USING btree ("search_profile_id");--> statement-breakpoint
CREATE INDEX "search_skill_idx" ON "search_profile_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "search_company_idx" ON "search_profiles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expiry_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "specialist_feed_idx" ON "specialist_profiles" USING btree ("search_status","profession_id","level","experience","work_format","city_id");--> statement-breakpoint
CREATE INDEX "specialist_skill_idx" ON "specialist_skills" USING btree ("skill_id");