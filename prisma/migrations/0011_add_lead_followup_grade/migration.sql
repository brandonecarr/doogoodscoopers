-- Add followup date and grade fields to lead tables

-- QuoteLead
ALTER TABLE "QuoteLead" ADD COLUMN "followupDate" TIMESTAMP(3);
ALTER TABLE "QuoteLead" ADD COLUMN "grade" TEXT;

-- CommercialLead
ALTER TABLE "CommercialLead" ADD COLUMN "followupDate" TIMESTAMP(3);
ALTER TABLE "CommercialLead" ADD COLUMN "grade" TEXT;
ALTER TABLE "CommercialLead" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- AdLead
ALTER TABLE "AdLead" ADD COLUMN "followupDate" TIMESTAMP(3);
ALTER TABLE "AdLead" ADD COLUMN "grade" TEXT;
ALTER TABLE "AdLead" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- OutOfAreaLead
ALTER TABLE "OutOfAreaLead" ADD COLUMN "followupDate" TIMESTAMP(3);
ALTER TABLE "OutOfAreaLead" ADD COLUMN "grade" TEXT;
ALTER TABLE "OutOfAreaLead" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- CareerApplication
ALTER TABLE "CareerApplication" ADD COLUMN "followupDate" TIMESTAMP(3);
ALTER TABLE "CareerApplication" ADD COLUMN "grade" TEXT;
ALTER TABLE "CareerApplication" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- Add indexes for followup queries
CREATE INDEX "QuoteLead_followupDate_idx" ON "QuoteLead"("followupDate");
CREATE INDEX "CommercialLead_followupDate_idx" ON "CommercialLead"("followupDate");
CREATE INDEX "CommercialLead_archived_idx" ON "CommercialLead"("archived");
CREATE INDEX "AdLead_followupDate_idx" ON "AdLead"("followupDate");
CREATE INDEX "AdLead_archived_idx" ON "AdLead"("archived");
CREATE INDEX "OutOfAreaLead_followupDate_idx" ON "OutOfAreaLead"("followupDate");
CREATE INDEX "OutOfAreaLead_archived_idx" ON "OutOfAreaLead"("archived");
CREATE INDEX "CareerApplication_followupDate_idx" ON "CareerApplication"("followupDate");
CREATE INDEX "CareerApplication_archived_idx" ON "CareerApplication"("archived");
