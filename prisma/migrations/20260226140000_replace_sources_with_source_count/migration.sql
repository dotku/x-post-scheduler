-- Replace sources JSON blob with a plain integer count.
-- The raw article list from external APIs is no longer stored —
-- only the AI-generated report content is retained.

-- Add the new column with a default of 0.
ALTER TABLE "MediaIndustryReport" ADD COLUMN "sourceCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill sourceCount from the existing JSON array length.
UPDATE "MediaIndustryReport"
SET "sourceCount" = jsonb_array_length("sources"::jsonb)
WHERE "sources" IS NOT NULL
  AND "sources" <> ''
  AND "sources" <> '[]';

-- Drop the old sources column.
ALTER TABLE "MediaIndustryReport" DROP COLUMN "sources";
