-- Add fullContentZh field to MediaNewsSource for storing cron-time Chinese translation
ALTER TABLE "MediaNewsSource" ADD COLUMN "fullContentZh" TEXT;
