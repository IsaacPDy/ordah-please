CREATE TABLE "group_invite_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone,
	"status" text NOT NULL,
	CONSTRAINT "group_invite_links_status_values" CHECK ("group_invite_links"."status" in ('active', 'rotated')),
	CONSTRAINT "group_invite_links_rotated_fields_match" CHECK (("group_invite_links"."status" = 'active' and "group_invite_links"."rotated_at" is null) or ("group_invite_links"."status" = 'rotated' and "group_invite_links"."rotated_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "group_invite_links" ADD CONSTRAINT "group_invite_links_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invite_links" ADD CONSTRAINT "group_invite_links_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_invite_links_one_active_per_group" ON "group_invite_links" USING btree ("group_id") WHERE "group_invite_links"."status" = 'active';