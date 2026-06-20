-- Explicit (pinned) note titles: when true, the title is set by the user and is
-- not re-derived from the note's first line on content edits.
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "title_manual" BOOLEAN NOT NULL DEFAULT false;
