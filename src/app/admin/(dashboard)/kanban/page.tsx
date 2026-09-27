import { redirect } from "next/navigation";
import { Columns3 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { PageHero } from "@/components/admin/PageHero";
import { KanbanManager } from "@/components/admin/KanbanManager";

export const dynamic = "force-dynamic";

export default async function KanbanPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Kanban"
        subtitle="Custom boards for anything you track in stages. Add as many columns and cards as you need."
        icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#C4B5FD,#6D3EF0)" }}><Columns3 className="w-[22px] h-[22px] text-white" /></div>}
      />
      <KanbanManager />
    </div>
  );
}
