-- Drip email steps can carry a designed email (the same drag-and-drop builder the
-- email blasts use) instead of plain text. `html` is the compiled body that is sent;
-- `designJson` is the builder's project data so the design can be re-opened.
ALTER TABLE "CampaignStep" ADD COLUMN IF NOT EXISTS "html" TEXT;
ALTER TABLE "CampaignStep" ADD COLUMN IF NOT EXISTS "designJson" JSONB;
