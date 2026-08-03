DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "public"."groups" AS "group_record"
		LEFT JOIN "public"."memberships" AS "membership"
			ON "membership"."group_id" = "group_record"."id"
			AND "membership"."role" = 'owner'
			AND "membership"."removed_at" IS NULL
		WHERE "group_record"."archived_at" IS NULL
		GROUP BY "group_record"."id"
		HAVING count("membership"."user_id") <> 1
	) THEN
		RAISE EXCEPTION 'Each active group must have exactly one active owner';
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "public"."food_selections" DROP CONSTRAINT "food_selections_source_fields_match";
--> statement-breakpoint
ALTER TYPE "public"."membership_role" RENAME VALUE 'organizer' TO 'manager';
--> statement-breakpoint
ALTER TYPE "public"."order_participant_role" RENAME VALUE 'organizer' TO 'manager';
--> statement-breakpoint
ALTER TYPE "public"."food_selection_source" RENAME VALUE 'organizer_resolution' TO 'manager_resolution';
--> statement-breakpoint
DROP INDEX "public"."memberships_one_active_group_per_user";
--> statement-breakpoint
ALTER TABLE "public"."orders" RENAME COLUMN "organizer_user_id" TO "manager_user_id";
--> statement-breakpoint
ALTER TABLE "public"."orders" RENAME CONSTRAINT "orders_organizer_user_id_users_id_fk" TO "orders_manager_user_id_users_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_one_active_owner_per_group" ON "public"."memberships" USING btree ("group_id") WHERE "memberships"."role" = 'owner' and "memberships"."removed_at" is null;
--> statement-breakpoint
ALTER TABLE "public"."food_selections" ADD CONSTRAINT "food_selections_source_fields_match" CHECK (("food_selections"."source" = 'saved_favorite' and "food_selections"."favorite_id" is not null and "food_selections"."resolved_by_user_id" is null) or ("food_selections"."source" = 'manager_resolution' and "food_selections"."resolved_by_user_id" is not null) or ("food_selections"."source" in ('inline', 'declined') and "food_selections"."favorite_id" is null and "food_selections"."resolved_by_user_id" is null));
