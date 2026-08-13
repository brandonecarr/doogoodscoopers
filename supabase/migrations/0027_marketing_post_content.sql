-- Marketing tasks that are social posts carry ready-to-paste content:
-- a caption and a linked Content Studio carousel draft.
ALTER TABLE "MarketingTask" ADD COLUMN IF NOT EXISTS "caption" TEXT;
ALTER TABLE "MarketingTask" ADD COLUMN IF NOT EXISTS "studioDraftId" TEXT;
