-- Track geocoding precision so the customer map overlay only ever plots pins at
-- the actual home (never a ZIP centroid). geoPrecise: true=exact address match,
-- false=only centroid, null=not yet evaluated.
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "geoPrecise" BOOLEAN;
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "geoAccuracy" TEXT;
