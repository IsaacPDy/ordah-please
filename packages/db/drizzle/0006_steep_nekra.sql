DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "branches"
    WHERE "source_key" IS NOT NULL
    GROUP BY "source_key"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot make branch source_key unique while duplicate source keys exist';
  END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "branches" DROP CONSTRAINT "branches_restaurant_id_source_key_unique";--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_source_key_unique" UNIQUE("source_key");
