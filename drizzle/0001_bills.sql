CREATE TABLE "bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pocket_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" integer,
	"category_id" uuid,
	"bank_account_id" uuid,
	"repeat" text NOT NULL,
	"day" integer NOT NULL,
	"month" integer,
	"skipped_on" date,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "bill_id" uuid;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "bill_for" date;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_pocket_id_pocket_id_fk" FOREIGN KEY ("pocket_id") REFERENCES "public"."pocket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_bank_account_id_bank_account_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_pocket_idx" ON "bill" USING btree ("pocket_id");--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_bill_id_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bill"("id") ON DELETE set null ON UPDATE no action;