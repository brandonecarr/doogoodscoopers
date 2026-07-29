-- Dog count per customer, mirrored from Sweep&Go.
--
-- Sweep&Go's API does NOT expose dog names or breeds anywhere: /clients/active
-- and /clients/inactive omit dogs entirely, and the dispatch board carries only
-- `number_of_dogs`. The count is also encoded in the plan code we already store
-- ("2d-1xW" = 2 dogs, once a week), so it's parsed from there on every sync.
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "numberOfDogs" INTEGER;

UPDATE "SweepandgoCustomer"
   SET "numberOfDogs" = (substring("subscriptionNames" from '([0-9]+)d-'))::int
 WHERE "subscriptionNames" ~ '[0-9]+d-';
