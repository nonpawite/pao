-- Every pocket before this release was in baht, so existing pockets are backfilled with THB. New pockets always name theirs.
ALTER TABLE "pocket" ADD COLUMN "currency" text DEFAULT 'THB' NOT NULL;--> statement-breakpoint
ALTER TABLE "pocket" ALTER COLUMN "currency" DROP DEFAULT;
