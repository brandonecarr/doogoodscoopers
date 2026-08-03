-- Instagram comment→DM automation. Apply on merge (additive, inert until configured).
CREATE TABLE IF NOT EXISTS "InstagramCampaign" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name" TEXT NOT NULL,
  "mediaId" TEXT,
  "keywords" TEXT[] NOT NULL DEFAULT '{}',
  "matchType" TEXT NOT NULL DEFAULT 'partial',
  "dmText" TEXT NOT NULL,
  "publicReply" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "followGate" BOOLEAN NOT NULL DEFAULT false,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "adminEmail" TEXT
);
CREATE INDEX IF NOT EXISTS "InstagramCampaign_active_idx" ON "InstagramCampaign"("active");
CREATE INDEX IF NOT EXISTS "InstagramCampaign_mediaId_idx" ON "InstagramCampaign"("mediaId");

CREATE TABLE IF NOT EXISTS "InstagramDm" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "campaignId" TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "mediaId" TEXT,
  "igUserId" TEXT,
  "username" TEXT,
  "commentText" TEXT,
  "text" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "error" TEXT,
  "sentAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstagramDm_commentId_key" ON "InstagramDm"("commentId");
CREATE INDEX IF NOT EXISTS "InstagramDm_status_idx" ON "InstagramDm"("status");
CREATE INDEX IF NOT EXISTS "InstagramDm_campaignId_idx" ON "InstagramDm"("campaignId");
CREATE INDEX IF NOT EXISTS "InstagramDm_createdAt_idx" ON "InstagramDm"("createdAt");
