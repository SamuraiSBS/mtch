CREATE TYPE "public"."company_photo_category" AS ENUM('OFFICE', 'TEAM', 'WORKSPACE', 'PROCESSES', 'OTHER');--> statement-breakpoint
ALTER TYPE "public"."social_platform" ADD VALUE 'VK' BEFORE 'INSTAGRAM';--> statement-breakpoint
ALTER TYPE "public"."social_platform" ADD VALUE 'LINKEDIN' BEFORE 'INSTAGRAM';--> statement-breakpoint
ALTER TYPE "public"."social_platform" ADD VALUE 'YOUTUBE' BEFORE 'INSTAGRAM';--> statement-breakpoint
ALTER TYPE "public"."social_platform" ADD VALUE 'X' BEFORE 'OTHER';--> statement-breakpoint
ALTER TABLE "company_photos" ADD COLUMN "category" "company_photo_category" DEFAULT 'OTHER' NOT NULL;