-- Phase 2: Instagram commenters → leads + tracked-link attribution.

-- New source value for the polymorphic lead tables.
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'INSTAGRAM';

-- Attribution fields on QuoteLead (set when a lead arrives via a tracked link).
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "sourceChannel" TEXT;
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "instagramLeadId" TEXT;
CREATE INDEX IF NOT EXISTS "QuoteLead_instagramLeadId_idx" ON "QuoteLead" ("instagramLeadId");

-- The InstagramLead table.
CREATE TABLE IF NOT EXISTS "InstagramLead" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT now(),
  "status"               "LeadStatus" NOT NULL DEFAULT 'NEW',
  "archived"             BOOLEAN NOT NULL DEFAULT false,
  "notes"                TEXT,
  "followupDate"         TIMESTAMP(3),
  "grade"                TEXT,
  "igUserId"             TEXT,
  "username"             TEXT,
  "commentText"          TEXT,
  "commentId"            TEXT,
  "mediaId"              TEXT,
  "campaignId"           TEXT,
  "campaignName"         TEXT,
  "commentCount"         INTEGER NOT NULL DEFAULT 1,
  "lastCommentAt"        TIMESTAMP(3),
  "trackingCode"         TEXT NOT NULL,
  "firstName"            TEXT,
  "lastName"             TEXT,
  "email"                TEXT,
  "phone"                TEXT,
  "zipCode"              TEXT,
  "convertedQuoteLeadId" TEXT,
  "convertedAt"          TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstagramLead_trackingCode_key" ON "InstagramLead" ("trackingCode");
CREATE INDEX IF NOT EXISTS "InstagramLead_status_idx" ON "InstagramLead" ("status");
CREATE INDEX IF NOT EXISTS "InstagramLead_archived_idx" ON "InstagramLead" ("archived");
CREATE INDEX IF NOT EXISTS "InstagramLead_createdAt_idx" ON "InstagramLead" ("createdAt");
CREATE INDEX IF NOT EXISTS "InstagramLead_igUserId_idx" ON "InstagramLead" ("igUserId");
CREATE INDEX IF NOT EXISTS "InstagramLead_username_idx" ON "InstagramLead" ("username");
