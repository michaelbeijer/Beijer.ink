-- Beijerterm.com article publishing: a second publish target, independent of
-- the existing autofingers `publish_target`. A notebook can target either,
-- both, or neither.
ALTER TABLE "notebooks" ADD COLUMN "publish_beijerterm" BOOLEAN NOT NULL DEFAULT false;

-- Per-note Beijerterm article metadata: { headword, aliases: string[], lang }.
-- headword + aliases are the search terms that surface the article; lang is the
-- article language (ISO 639-1). Null for ordinary notes.
ALTER TABLE "notes" ADD COLUMN "metadata" JSONB;
