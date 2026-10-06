CREATE TABLE "receipt_object_cleanup" (
	"object_key" text PRIMARY KEY NOT NULL,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_receipt_settings" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"mode" text DEFAULT 'group' NOT NULL,
	"submitter_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "receipt_settings_mode" CHECK ("order_receipt_settings"."mode" in ('group', 'individual'))
);
--> statement-breakpoint
CREATE TABLE "receipt_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"participant_user_id" uuid,
	"mode" text NOT NULL,
	"amount_centavos" bigint NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"finalized_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_order_id_unique";--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "upload_id" uuid;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "mode" text DEFAULT 'group' NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "participant_user_id" uuid;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "participant_name" text;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "amount_centavos" bigint;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "order_receipt_settings" ADD CONSTRAINT "order_receipt_settings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_uploads" ADD CONSTRAINT "receipt_uploads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_uploads" ADD CONSTRAINT "receipt_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_uploads" ADD CONSTRAINT "receipt_uploads_participant_user_id_users_id_fk" FOREIGN KEY ("participant_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_participant_user_id_users_id_fk" FOREIGN KEY ("participant_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_upload_id_unique" UNIQUE("upload_id");--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_subject" CHECK (("receipts"."mode" = 'group' and "receipts"."participant_user_id" is null) or ("receipts"."mode" = 'individual' and "receipts"."participant_user_id" is not null));--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_positive_amount" CHECK ("receipts"."amount_centavos" is null or "receipts"."amount_centavos" > 0);--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_note_length" CHECK (length("receipts"."note") <= 2000);