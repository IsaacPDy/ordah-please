ALTER TABLE "menu_items" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "cuisines" text[] DEFAULT '{}'::text[] NOT NULL;