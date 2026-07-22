CREATE TYPE "public"."admin_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."catalog_import_status" AS ENUM('draft', 'invalid', 'validated', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."favorite_availability" AS ENUM('available', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."file_purpose" AS ENUM('menu_thumbnail', 'receipt', 'import_source', 'validation_report');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."food_response_status" AS ENUM('pending', 'confirmed', 'declined', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."food_selection_source" AS ENUM('saved_favorite', 'inline', 'organizer_resolution', 'declined');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'organizer', 'member');--> statement-breakpoint
CREATE TYPE "public"."menu_version_status" AS ENUM('draft', 'published', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_participant_role" AS ENUM('organizer', 'member');--> statement-breakpoint
CREATE TYPE "public"."order_state" AS ENUM('draft', 'restaurant_voting', 'food_confirmation', 'ready_for_handoff', 'ordered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."refresh_review_outcome" AS ENUM('auto_published', 'approved', 'rejected', 'failed');--> statement-breakpoint
CREATE TYPE "public"."refresh_status" AS ENUM('pending', 'collecting', 'review_required', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."restaurant_choice_mode" AS ENUM('voting_disabled', 'shortlist', 'global_catalog');--> statement-breakpoint
CREATE TYPE "public"."restaurant_response_status" AS ENUM('pending', 'responded');--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"source_key" text,
	"name" text NOT NULL,
	"address" text,
	"grab_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "branches_restaurant_id_source_key_unique" UNIQUE("restaurant_id","source_key"),
	CONSTRAINT "branches_restaurant_id_id_unique" UNIQUE("restaurant_id","id")
);
--> statement-breakpoint
CREATE TABLE "catalog_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_file_id" uuid,
	"validation_report_file_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"status" "catalog_import_status" DEFAULT 'draft' NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_version_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "menu_categories_version_sort_unique" UNIQUE("menu_version_id","sort_order"),
	CONSTRAINT "menu_categories_non_negative_sort" CHECK ("menu_categories"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_item_modifier_groups" (
	"menu_item_id" uuid NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	CONSTRAINT "menu_item_modifier_groups_menu_item_id_modifier_group_id_pk" PRIMARY KEY("menu_item_id","modifier_group_id")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_price_centavos" bigint NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "menu_items_category_source_key_unique" UNIQUE("category_id","source_key"),
	CONSTRAINT "menu_items_non_negative_price" CHECK ("menu_items"."base_price_centavos" >= 0),
	CONSTRAINT "menu_items_non_negative_sort" CHECK ("menu_items"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_version_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"name" text NOT NULL,
	"minimum_selections" integer DEFAULT 0 NOT NULL,
	"maximum_selections" integer NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "menu_modifier_groups_version_source_key_unique" UNIQUE("menu_version_id","source_key"),
	CONSTRAINT "menu_modifier_groups_selection_bounds" CHECK ("menu_modifier_groups"."minimum_selections" >= 0 and "menu_modifier_groups"."maximum_selections" >= "menu_modifier_groups"."minimum_selections"),
	CONSTRAINT "menu_modifier_groups_non_negative_sort" CHECK ("menu_modifier_groups"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_modifier_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"name" text NOT NULL,
	"price_delta_centavos" bigint DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "menu_modifier_options_group_source_key_unique" UNIQUE("modifier_group_id","source_key"),
	CONSTRAINT "menu_modifier_options_non_negative_sort" CHECK ("menu_modifier_options"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"name" text NOT NULL,
	"price_delta_centavos" bigint DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "menu_variants_item_source_key_unique" UNIQUE("menu_item_id","source_key"),
	CONSTRAINT "menu_variants_non_negative_sort" CHECK ("menu_variants"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"source_import_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "menu_version_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "menu_versions_branch_version_unique" UNIQUE("branch_id","version_number"),
	CONSTRAINT "menu_versions_branch_id_id_unique" UNIQUE("branch_id","id"),
	CONSTRAINT "menu_versions_positive_version" CHECK ("menu_versions"."version_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "refresh_review_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"refresh_run_id" uuid NOT NULL,
	"outcome" "refresh_review_outcome" NOT NULL,
	"decided_by_user_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"status" "refresh_status" DEFAULT 'pending' NOT NULL,
	"comparison_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paused_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "file_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" "file_purpose" NOT NULL,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finalized_at" timestamp with time zone,
	CONSTRAINT "file_records_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "file_records_non_negative_size" CHECK ("file_records"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "admin_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"status" "admin_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by_user_id" uuid,
	"decision_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "admin_access_requests_decision_fields_match_status" CHECK (("admin_access_requests"."status" = 'pending' and "admin_access_requests"."decided_at" is null and "admin_access_requests"."decided_by_user_id" is null) or ("admin_access_requests"."status" <> 'pending' and "admin_access_requests"."decided_at" is not null and "admin_access_requests"."decided_by_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "group_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"recipient_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"line_one" text NOT NULL,
	"line_two" text,
	"city" text NOT NULL,
	"postal_code" text,
	"notes" text,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_addresses_group_id_unique" UNIQUE("group_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"accepted_by_user_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitations_acceptance_fields_match" CHECK (("invitations"."accepted_at" is null and "invitations"."accepted_by_user_id" is null) or ("invitations"."accepted_at" is not null and "invitations"."accepted_by_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "memberships_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"kind" text NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "jobs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "jobs_attempt_bounds" CHECK ("jobs"."attempts" >= 0 and "jobs"."max_attempts" > 0 and "jobs"."attempts" <= "jobs"."max_attempts")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"order_id" uuid,
	"event_type" text NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "favorite_item_modifiers" (
	"favorite_item_id" uuid NOT NULL,
	"modifier_option_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "favorite_item_modifiers_favorite_item_id_modifier_option_id_pk" PRIMARY KEY("favorite_item_id","modifier_option_id"),
	CONSTRAINT "favorite_item_modifiers_positive_quantity" CHECK ("favorite_item_modifiers"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "favorite_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"favorite_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "favorite_items_positive_quantity" CHECK ("favorite_items"."quantity" > 0),
	CONSTRAINT "favorite_items_non_negative_sort" CHECK ("favorite_items"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"menu_version_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"name" text NOT NULL,
	"availability" "favorite_availability" DEFAULT 'available' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_branch_rank_unique" UNIQUE("user_id","branch_id","rank"),
	CONSTRAINT "favorites_rank_between_1_and_3" CHECK ("favorites"."rank" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "food_selections" (
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "food_selection_source" NOT NULL,
	"favorite_id" uuid,
	"resolved_by_user_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_selections_order_id_user_id_pk" PRIMARY KEY("order_id","user_id"),
	CONSTRAINT "food_selections_source_fields_match" CHECK (("food_selections"."source" = 'saved_favorite' and "food_selections"."favorite_id" is not null and "food_selections"."resolved_by_user_id" is null) or ("food_selections"."source" = 'organizer_resolution' and "food_selections"."resolved_by_user_id" is not null) or ("food_selections"."source" in ('inline', 'declined') and "food_selections"."favorite_id" is null and "food_selections"."resolved_by_user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "order_line_modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_line_id" uuid NOT NULL,
	"modifier_name_snapshot" text NOT NULL,
	"quantity" integer NOT NULL,
	"price_delta_centavos" bigint NOT NULL,
	CONSTRAINT "order_line_modifiers_positive_quantity" CHECK ("order_line_modifiers"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source_menu_item_id" uuid,
	"item_name_snapshot" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_centavos" bigint NOT NULL,
	"variant_name_snapshot" text,
	"note_snapshot" text DEFAULT '' NOT NULL,
	"line_subtotal_centavos" bigint NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "order_lines_positive_quantity" CHECK ("order_lines"."quantity" > 0),
	CONSTRAINT "order_lines_non_negative_unit_price" CHECK ("order_lines"."unit_price_centavos" >= 0),
	CONSTRAINT "order_lines_non_negative_subtotal" CHECK ("order_lines"."line_subtotal_centavos" >= 0),
	CONSTRAINT "order_lines_non_negative_sort" CHECK ("order_lines"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_participants" (
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name_snapshot" text NOT NULL,
	"role" "order_participant_role" NOT NULL,
	"restaurant_response" "restaurant_response_status" DEFAULT 'pending' NOT NULL,
	"food_response" "food_response_status" DEFAULT 'pending' NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_participants_order_id_user_id_pk" PRIMARY KEY("order_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"organizer_user_id" uuid NOT NULL,
	"state" "order_state" DEFAULT 'draft' NOT NULL,
	"choice_mode" "restaurant_choice_mode" NOT NULL,
	"initial_restaurant_id" uuid NOT NULL,
	"initial_branch_id" uuid NOT NULL,
	"selected_restaurant_id" uuid,
	"selected_branch_id" uuid,
	"selected_restaurant_name_snapshot" text,
	"selected_branch_name_snapshot" text,
	"delivery_address_snapshot" jsonb NOT NULL,
	"restaurant_deadline" timestamp with time zone NOT NULL,
	"food_deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "orders_food_deadline_after_restaurant_deadline" CHECK ("orders"."food_deadline" > "orders"."restaurant_deadline"),
	CONSTRAINT "orders_selected_restaurant_snapshot_complete" CHECK (("orders"."selected_restaurant_id" is null and "orders"."selected_branch_id" is null and "orders"."selected_restaurant_name_snapshot" is null and "orders"."selected_branch_name_snapshot" is null) or ("orders"."selected_restaurant_id" is not null and "orders"."selected_branch_id" is not null and "orders"."selected_restaurant_name_snapshot" is not null and "orders"."selected_branch_name_snapshot" is not null)),
	CONSTRAINT "orders_completion_matches_terminal_state" CHECK (("orders"."state" in ('ordered', 'cancelled') and "orders"."completed_at" is not null) or ("orders"."state" not in ('ordered', 'cancelled') and "orders"."completed_at" is null))
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "receipts_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
CREATE TABLE "restaurant_votes" (
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_votes_order_id_user_id_pk" PRIMARY KEY("order_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_source_file_id_file_records_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."file_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_validation_report_file_id_file_records_id_fk" FOREIGN KEY ("validation_report_file_id") REFERENCES "public"."file_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_menu_version_id_menu_versions_id_fk" FOREIGN KEY ("menu_version_id") REFERENCES "public"."menu_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_modifier_groups" ADD CONSTRAINT "menu_item_modifier_groups_modifier_group_id_menu_modifier_groups_id_fk" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."menu_modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_modifier_groups" ADD CONSTRAINT "menu_modifier_groups_menu_version_id_menu_versions_id_fk" FOREIGN KEY ("menu_version_id") REFERENCES "public"."menu_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_modifier_options" ADD CONSTRAINT "menu_modifier_options_modifier_group_id_menu_modifier_groups_id_fk" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."menu_modifier_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_variants" ADD CONSTRAINT "menu_variants_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_versions" ADD CONSTRAINT "menu_versions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_versions" ADD CONSTRAINT "menu_versions_source_import_id_catalog_imports_id_fk" FOREIGN KEY ("source_import_id") REFERENCES "public"."catalog_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_review_outcomes" ADD CONSTRAINT "refresh_review_outcomes_refresh_run_id_refresh_runs_id_fk" FOREIGN KEY ("refresh_run_id") REFERENCES "public"."refresh_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_review_outcomes" ADD CONSTRAINT "refresh_review_outcomes_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_runs" ADD CONSTRAINT "refresh_runs_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_runs" ADD CONSTRAINT "refresh_runs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_records" ADD CONSTRAINT "file_records_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_access_requests" ADD CONSTRAINT "admin_access_requests_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_access_requests" ADD CONSTRAINT "admin_access_requests_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_access_requests" ADD CONSTRAINT "admin_access_requests_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_addresses" ADD CONSTRAINT "group_addresses_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_addresses" ADD CONSTRAINT "group_addresses_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_item_modifiers" ADD CONSTRAINT "favorite_item_modifiers_favorite_item_id_favorite_items_id_fk" FOREIGN KEY ("favorite_item_id") REFERENCES "public"."favorite_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_item_modifiers" ADD CONSTRAINT "favorite_item_modifiers_modifier_option_id_menu_modifier_options_id_fk" FOREIGN KEY ("modifier_option_id") REFERENCES "public"."menu_modifier_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_items" ADD CONSTRAINT "favorite_items_favorite_id_favorites_id_fk" FOREIGN KEY ("favorite_id") REFERENCES "public"."favorites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_items" ADD CONSTRAINT "favorite_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_items" ADD CONSTRAINT "favorite_items_variant_id_menu_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."menu_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_menu_version_id_menu_versions_id_fk" FOREIGN KEY ("menu_version_id") REFERENCES "public"."menu_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_menu_version_matches_branch_fk" FOREIGN KEY ("branch_id","menu_version_id") REFERENCES "public"."menu_versions"("branch_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_selections" ADD CONSTRAINT "food_selections_favorite_id_favorites_id_fk" FOREIGN KEY ("favorite_id") REFERENCES "public"."favorites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_selections" ADD CONSTRAINT "food_selections_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_selections" ADD CONSTRAINT "food_selections_selected_participant_fk" FOREIGN KEY ("order_id","user_id") REFERENCES "public"."order_participants"("order_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_modifiers" ADD CONSTRAINT "order_line_modifiers_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_source_menu_item_id_menu_items_id_fk" FOREIGN KEY ("source_menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_selected_participant_fk" FOREIGN KEY ("order_id","user_id") REFERENCES "public"."order_participants"("order_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_participants" ADD CONSTRAINT "order_participants_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_participants" ADD CONSTRAINT "order_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_organizer_user_id_users_id_fk" FOREIGN KEY ("organizer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_initial_restaurant_id_restaurants_id_fk" FOREIGN KEY ("initial_restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_initial_branch_id_branches_id_fk" FOREIGN KEY ("initial_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_selected_restaurant_id_restaurants_id_fk" FOREIGN KEY ("selected_restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_selected_branch_id_branches_id_fk" FOREIGN KEY ("selected_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_initial_branch_matches_restaurant_fk" FOREIGN KEY ("initial_restaurant_id","initial_branch_id") REFERENCES "public"."branches"("restaurant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_selected_branch_matches_restaurant_fk" FOREIGN KEY ("selected_restaurant_id","selected_branch_id") REFERENCES "public"."branches"("restaurant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_file_id_file_records_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_votes" ADD CONSTRAINT "restaurant_votes_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_votes" ADD CONSTRAINT "restaurant_votes_selected_participant_fk" FOREIGN KEY ("order_id","user_id") REFERENCES "public"."order_participants"("order_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_versions_one_published_per_branch" ON "menu_versions" USING btree ("branch_id") WHERE "menu_versions"."status" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX "admin_access_requests_one_pending_per_user" ON "admin_access_requests" USING btree ("requester_user_id") WHERE "admin_access_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_one_active_group_per_user" ON "memberships" USING btree ("user_id") WHERE "memberships"."removed_at" is null;