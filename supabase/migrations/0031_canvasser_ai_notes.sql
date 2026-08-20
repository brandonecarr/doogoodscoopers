-- At-the-door AI note-taking: transcript-derived notes attached to a canvass
-- pin, carried over to the lead on conversion. Audio is never stored.
ALTER TABLE "CanvassVisit" ADD COLUMN IF NOT EXISTS "aiNotes" TEXT;
ALTER TABLE "CanvasserLead" ADD COLUMN IF NOT EXISTS "aiNotes" TEXT;
