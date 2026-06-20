-- autofingers.com publishing pipeline.
-- A notebook flagged publish_target has all its notes published to the static site.
-- Notes gain a subtitle (the kicker line) and an optional slug (URL override).
ALTER TABLE "notebooks" ADD COLUMN IF NOT EXISTS "publish_target" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "subtitle" TEXT;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "slug" TEXT;
