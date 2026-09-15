-- Merge prospects under a management company: the company absorbs properties as
-- child records (nothing flattened, fully reversible). isManagementCompany flags
-- the parent so its info page shows the managed-properties list.
ALTER TABLE "CommercialProspect" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "CommercialProspect" ADD COLUMN IF NOT EXISTS "isManagementCompany" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CommercialProspect"
  ADD CONSTRAINT "CommercialProspect_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "CommercialProspect"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "CommercialProspect_parentId_idx" ON "CommercialProspect"("parentId");
