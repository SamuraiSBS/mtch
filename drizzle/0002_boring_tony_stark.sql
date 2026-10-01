CREATE TABLE "avatar_assets" (
	"file_id" uuid PRIMARY KEY NOT NULL,
	"original_storage_key" text NOT NULL,
	"medium_storage_key" text NOT NULL,
	"small_storage_key" text NOT NULL,
	"original_mime_type" varchar(80) NOT NULL,
	CONSTRAINT "avatar_assets_original_storage_key_unique" UNIQUE("original_storage_key"),
	CONSTRAINT "avatar_assets_medium_storage_key_unique" UNIQUE("medium_storage_key"),
	CONSTRAINT "avatar_assets_small_storage_key_unique" UNIQUE("small_storage_key")
);
--> statement-breakpoint
ALTER TABLE "avatar_assets" ADD CONSTRAINT "avatar_assets_file_id_media_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media_files"("id") ON DELETE cascade ON UPDATE no action;