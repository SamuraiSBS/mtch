CREATE TABLE "employer_specialist_favorites" (
	"employer_user_id" text NOT NULL,
	"specialist_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employer_specialist_favorites_pkey" PRIMARY KEY("employer_user_id", "specialist_user_id")
);
--> statement-breakpoint
ALTER TABLE "employer_specialist_favorites" ADD CONSTRAINT "employer_specialist_favorites_employer_user_id_user_id_fk" FOREIGN KEY ("employer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "employer_specialist_favorites" ADD CONSTRAINT "employer_specialist_favorites_specialist_user_id_user_id_fk" FOREIGN KEY ("specialist_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "employer_specialist_favorites_candidate_idx" ON "employer_specialist_favorites" USING btree ("specialist_user_id", "created_at");
