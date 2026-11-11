ALTER TABLE "bill" ADD COLUMN "ends_after" integer;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "ends_on" date;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "paused_on" date;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "resumed_on" date;