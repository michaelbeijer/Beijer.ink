-- Two-way Google Tasks sync: link a card to the Google task it mirrors.
ALTER TABLE "cards" ADD COLUMN "google_task_id" TEXT;
CREATE INDEX "cards_google_task_id_idx" ON "cards"("google_task_id");
