-- CreateTable: MediaNewsSource
-- Stores raw source articles fetched during each report generation run.
-- Enables display of original articles on report pages.
-- Old rows (> 3 years) are purged by the media-news cron job.

CREATE TABLE "MediaNewsSource" (
  "id"          TEXT NOT NULL,
  "reportDate"  TEXT NOT NULL,
  "period"      TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "source"      TEXT NOT NULL,
  "publishedAt" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "imageUrl"    TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaNewsSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaNewsSource_reportDate_period_url_key"
  ON "MediaNewsSource"("reportDate", "period", "url");

CREATE INDEX "MediaNewsSource_reportDate_period_idx"
  ON "MediaNewsSource"("reportDate", "period");

CREATE INDEX "MediaNewsSource_createdAt_idx"
  ON "MediaNewsSource"("createdAt");
