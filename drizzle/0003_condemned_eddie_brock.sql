CREATE TYPE "public"."employment_goal" AS ENUM('JOB', 'INTERNSHIP', 'PRACTICE', 'OPEN_TO_OFFERS');--> statement-breakpoint
CREATE TYPE "public"."practice_invitation_status" AS ENUM('SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'INTERVIEW', 'HIRED');--> statement-breakpoint
CREATE TYPE "public"."practice_status" AS ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "practice_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_recruitment_id" uuid NOT NULL,
	"employer_user_id" text NOT NULL,
	"candidate_user_id" text NOT NULL,
	"message" text NOT NULL,
	"status" "practice_invitation_status" DEFAULT 'SENT' NOT NULL,
	"score_at_send" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_recruitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employer_user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"direction" varchar(40) NOT NULL,
	"slots_total" integer NOT NULL,
	"practice_start_date" date NOT NULL,
	"practice_end_date" date NOT NULL,
	"work_formats" text[] NOT NULL,
	"city_id" uuid,
	"required_skill_ids" uuid[] NOT NULL,
	"optional_skill_ids" uuid[] NOT NULL,
	"study_course_min" integer,
	"study_course_max" integer,
	"official_practice_support" boolean DEFAULT false NOT NULL,
	"status" "practice_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_recruitment_slots_check" CHECK ("practice_recruitments"."slots_total" > 0),
	CONSTRAINT "practice_recruitment_dates_check" CHECK ("practice_recruitments"."practice_end_date" > "practice_recruitments"."practice_start_date")
);
--> statement-breakpoint
ALTER TABLE "specialist_profiles" DROP CONSTRAINT "specialist_salary_check";--> statement-breakpoint
ALTER TABLE "specialist_profiles" ALTER COLUMN "salary_min_rub" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ALTER COLUMN "salary_max_rub" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD COLUMN "employment_goal" "employment_goal" DEFAULT 'OPEN_TO_OFFERS' NOT NULL;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD COLUMN "educational_institution" varchar(200);--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD COLUMN "education_program" varchar(200);--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD COLUMN "study_course" integer;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD COLUMN "practice_start_date" date;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD COLUMN "practice_end_date" date;--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD COLUMN "desired_directions" text[];--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD COLUMN "practice_work_formats" text[];--> statement-breakpoint
ALTER TABLE "practice_invitations" ADD CONSTRAINT "practice_invitations_practice_recruitment_id_practice_recruitments_id_fk" FOREIGN KEY ("practice_recruitment_id") REFERENCES "public"."practice_recruitments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_invitations" ADD CONSTRAINT "practice_invitations_employer_user_id_user_id_fk" FOREIGN KEY ("employer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_invitations" ADD CONSTRAINT "practice_invitations_candidate_user_id_user_id_fk" FOREIGN KEY ("candidate_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_recruitments" ADD CONSTRAINT "practice_recruitments_employer_user_id_user_id_fk" FOREIGN KEY ("employer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_recruitments" ADD CONSTRAINT "practice_recruitments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_recruitments" ADD CONSTRAINT "practice_recruitments_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "practice_invitation_active_unique" ON "practice_invitations" USING btree ("practice_recruitment_id","candidate_user_id") WHERE "practice_invitations"."status" in ('SENT','VIEWED','ACCEPTED','INTERVIEW','HIRED');--> statement-breakpoint
CREATE INDEX "practice_invitation_candidate_idx" ON "practice_invitations" USING btree ("candidate_user_id","created_at");--> statement-breakpoint
CREATE INDEX "practice_invitation_recruitment_idx" ON "practice_invitations" USING btree ("practice_recruitment_id","created_at");--> statement-breakpoint
CREATE INDEX "practice_recruitment_company_idx" ON "practice_recruitments" USING btree ("company_id","created_at");--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD CONSTRAINT "specialist_practice_dates_check" CHECK ("specialist_profiles"."practice_start_date" is null or "specialist_profiles"."practice_end_date" > "specialist_profiles"."practice_start_date");--> statement-breakpoint
ALTER TABLE "specialist_profiles" ADD CONSTRAINT "specialist_salary_check" CHECK (("specialist_profiles"."employment_goal" = 'PRACTICE' and "specialist_profiles"."salary_min_rub" is null and "specialist_profiles"."salary_max_rub" is null) or ("specialist_profiles"."employment_goal" <> 'PRACTICE' and "specialist_profiles"."salary_min_rub" > 0 and "specialist_profiles"."salary_max_rub" >= "specialist_profiles"."salary_min_rub"));