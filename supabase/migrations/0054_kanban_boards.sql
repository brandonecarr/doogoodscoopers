-- Custom Kanban boards: any number of boards, each with any number of columns and cards.
-- Managed at /admin/kanban; a board can also be shown on the office TV.
CREATE TABLE IF NOT EXISTS "KanbanBoard" (
  "id"         TEXT PRIMARY KEY,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"       TEXT NOT NULL,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "KanbanColumn" (
  "id"         TEXT PRIMARY KEY,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "boardId"    TEXT NOT NULL REFERENCES "KanbanBoard"("id") ON DELETE CASCADE,
  "name"       TEXT NOT NULL,
  "color"      TEXT,                                  -- gray | blue | green | amber | red | violet | teal
  "isDone"     BOOLEAN NOT NULL DEFAULT false,        -- highlighted like "Done"/"Won" on the TV
  "sortOrder"  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "KanbanColumn_boardId_sortOrder_idx" ON "KanbanColumn" ("boardId", "sortOrder");

CREATE TABLE IF NOT EXISTS "KanbanCard" (
  "id"         TEXT PRIMARY KEY,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "boardId"    TEXT NOT NULL REFERENCES "KanbanBoard"("id") ON DELETE CASCADE,
  "columnId"   TEXT NOT NULL REFERENCES "KanbanColumn"("id") ON DELETE CASCADE,
  "title"      TEXT NOT NULL,
  "notes"      TEXT,
  "tag"        TEXT,
  "owner"      TEXT,
  "dueOn"      TIMESTAMP(3),
  "sortOrder"  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "KanbanCard_columnId_sortOrder_idx" ON "KanbanCard" ("columnId", "sortOrder");
CREATE INDEX IF NOT EXISTS "KanbanCard_boardId_idx" ON "KanbanCard" ("boardId");

-- Server-only tables (Prisma connects as the owner); keep them closed to the anon/auth API roles.
ALTER TABLE "KanbanBoard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanColumn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KanbanCard" ENABLE ROW LEVEL SECURITY;
