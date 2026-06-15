-- AlterTable: add server-side board type + settings
ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'freeform';
ALTER TABLE "boards" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';
