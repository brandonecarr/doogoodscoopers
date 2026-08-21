-- Canvassing territories: an admin-drawn polygon with an estimated home count,
-- optionally assigned to a canvasser.
CREATE TABLE IF NOT EXISTS "CanvassTerritory" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "name" TEXT NOT NULL,
  "polygon" JSONB NOT NULL,
  "homeCount" INTEGER NOT NULL DEFAULT 0,
  "areaAcres" DOUBLE PRECISION,
  "assignedCanvasserId" TEXT,
  "assignedCanvasserName" TEXT,
  "color" TEXT NOT NULL DEFAULT '#6D3EF0',
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "CanvassTerritory_assignedCanvasserId_idx" ON "CanvassTerritory"("assignedCanvasserId");
CREATE INDEX IF NOT EXISTS "CanvassTerritory_archived_idx" ON "CanvassTerritory"("archived");
ALTER TABLE "CanvassTerritory" ENABLE ROW LEVEL SECURITY;
