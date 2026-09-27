import { redirect } from "next/navigation";

// Kanban boards now live in Office TV; keep old links and bookmarks working.
export default function KanbanPage() {
  redirect("/admin/office-tv?tab=kanban");
}
