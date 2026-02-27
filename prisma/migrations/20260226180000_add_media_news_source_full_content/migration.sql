-- Add fullContent column to MediaNewsSource
-- Stores full article body for sources that provide it (e.g. The Guardian API).

ALTER TABLE "MediaNewsSource" ADD COLUMN "fullContent" TEXT;
