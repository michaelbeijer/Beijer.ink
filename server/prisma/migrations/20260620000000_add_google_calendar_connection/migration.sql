-- CreateTable: single-user Google Calendar OAuth tokens + per-calendar source config
CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMP(3),
    "scope" TEXT,
    "calendars" JSONB NOT NULL DEFAULT '[]',
    "connected_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_connections_user_id_key" ON "google_calendar_connections"("user_id");
