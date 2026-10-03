CREATE TABLE "specialist_favorites" (
	"specialist_user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "specialist_favorites_specialist_user_id_company_id_pk" PRIMARY KEY("specialist_user_id","company_id"),
	CONSTRAINT "specialist_favorites_specialist_user_id_user_id_fk" FOREIGN KEY ("specialist_user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
	CONSTRAINT "specialist_favorites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "specialist_favorites_company_idx" ON "specialist_favorites" USING btree ("company_id","created_at");
--> statement-breakpoint
CREATE TABLE "match_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"sender_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_messages_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade,
	CONSTRAINT "match_messages_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "match_messages_chat_idx" ON "match_messages" USING btree ("match_id","created_at");
