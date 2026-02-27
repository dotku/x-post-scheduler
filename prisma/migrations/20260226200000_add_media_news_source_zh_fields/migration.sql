-- Add Chinese translation fields to MediaNewsSource
ALTER TABLE "MediaNewsSource" ADD COLUMN "titleZh" TEXT;
ALTER TABLE "MediaNewsSource" ADD COLUMN "descriptionZh" TEXT;
