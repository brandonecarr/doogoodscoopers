-- Facebook Messenger integration: new lead source + conversation table.
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'MESSENGER';

CREATE TABLE IF NOT EXISTS "MessengerLead" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "followupDate" TIMESTAMP(3),
  "grade" TEXT,
  "psid" TEXT NOT NULL,
  "pageId" TEXT,
  "name" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "profilePicUrl" TEXT,
  "lastMessage" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "unread" BOOLEAN NOT NULL DEFAULT true,
  "rawPayload" JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS "MessengerLead_psid_key" ON "MessengerLead"("psid");
CREATE INDEX IF NOT EXISTS "MessengerLead_status_idx" ON "MessengerLead"("status");
CREATE INDEX IF NOT EXISTS "MessengerLead_archived_idx" ON "MessengerLead"("archived");
CREATE INDEX IF NOT EXISTS "MessengerLead_unread_idx" ON "MessengerLead"("unread");
CREATE INDEX IF NOT EXISTS "MessengerLead_lastMessageAt_idx" ON "MessengerLead"("lastMessageAt");
