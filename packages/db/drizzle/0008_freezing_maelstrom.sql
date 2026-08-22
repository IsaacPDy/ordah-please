CREATE TABLE "order_shortlist_restaurants" (
	"order_id" uuid NOT NULL,
	"restaurant_id" uuid NOT NULL,
	CONSTRAINT "order_shortlist_restaurants_order_id_restaurant_id_pk" PRIMARY KEY("order_id","restaurant_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "selected_menu_version_id" uuid;--> statement-breakpoint
ALTER TABLE "order_shortlist_restaurants" ADD CONSTRAINT "order_shortlist_restaurants_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_shortlist_restaurants" ADD CONSTRAINT "order_shortlist_restaurants_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_selected_menu_version_id_menu_versions_id_fk" FOREIGN KEY ("selected_menu_version_id") REFERENCES "public"."menu_versions"("id") ON DELETE no action ON UPDATE no action;