ALTER TABLE "bill" ADD COLUMN "first_due" date;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "bill" ADD COLUMN "every" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Same rule as toSchedule in src/lib/bills.ts: the first due date on or after the day the bill was added,
-- in a month long enough for its day (a yearly "31 Feb" meant that year's last day of February).
-- ponytail: uses the server's date for created_at, not APP_TZ; off by a day only for bills added near midnight.
UPDATE "bill" b SET
  "unit" = CASE b."repeat" WHEN 'monthly' THEN 'month' ELSE 'year' END,
  "first_due" = (
    SELECT min(x.d)
    FROM generate_series(0, 72) AS k,
      LATERAL (SELECT (date_trunc('month', b."created_at") + make_interval(months => k))::date AS ms) AS m,
      LATERAL (
        SELECT m.ms + (CASE WHEN b."repeat" = 'yearly'
          THEN least(b."day", extract(day FROM m.ms + interval '1 month - 1 day')::int)
          ELSE b."day" END) - 1 AS d
      ) AS x
    WHERE extract(month FROM x.d) = extract(month FROM m.ms)
      AND x.d >= b."created_at"::date
      AND (b."repeat" = 'monthly' OR extract(month FROM x.d) = b."month")
  );--> statement-breakpoint
ALTER TABLE "bill" ALTER COLUMN "first_due" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bill" ALTER COLUMN "unit" SET NOT NULL;
