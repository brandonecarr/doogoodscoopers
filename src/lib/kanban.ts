// Custom Kanban boards (/admin/kanban). Any number of boards, columns and cards.
import prisma from "@/lib/prisma";
import { fromDateInputValue } from "@/lib/datetime";

export const COLUMN_COLORS = ["gray", "blue", "green", "amber", "red", "violet", "teal"] as const;
export type ColumnColor = (typeof COLUMN_COLORS)[number];

export const DEFAULT_COLUMNS = [
  { name: "To do", isDone: false },
  { name: "In progress", isDone: false },
  { name: "Done", isDone: true },
];

/** A whole board with its columns and cards, in display order. */
export function loadBoard(id: string) {
  return prisma.kanbanBoard.findUnique({
    where: { id },
    include: {
      columns: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      cards: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}

const text = (v: unknown, max: number) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};

/** Card fields from a request body; only keys that were sent are returned. */
export function cardFields(b: Record<string, unknown>) {
  const data: { title?: string; notes?: string | null; tag?: string | null; owner?: string | null; dueOn?: Date | null } = {};
  if (b.title !== undefined) {
    const title = text(b.title, 200);
    if (!title) throw new Error("A card needs a title");
    data.title = title;
  }
  if (b.notes !== undefined) data.notes = text(b.notes, 4000);
  if (b.tag !== undefined) data.tag = text(b.tag, 40);
  if (b.owner !== undefined) data.owner = text(b.owner, 60);
  if (b.dueOn !== undefined) data.dueOn = b.dueOn ? new Date(fromDateInputValue(String(b.dueOn))!) : null;
  return data;
}

/** Column fields from a request body; only keys that were sent are returned. */
export function columnFields(b: Record<string, unknown>) {
  const data: { name?: string; color?: string | null; isDone?: boolean } = {};
  if (b.name !== undefined) {
    const name = text(b.name, 60);
    if (!name) throw new Error("A column needs a name");
    data.name = name;
  }
  if (b.color !== undefined) data.color = COLUMN_COLORS.includes(b.color as ColumnColor) ? (b.color as string) : null;
  if (b.isDone !== undefined) data.isDone = Boolean(b.isDone);
  return data;
}
