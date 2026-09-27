import { redirect } from "next/navigation";
import { ListTodo } from "lucide-react";
import { getSession } from "@/lib/auth";
import { PageHero } from "@/components/admin/PageHero";
import { TaskBoard } from "@/components/admin/TaskBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Tasks"
        subtitle="The team's to-do list. It also shows on the office TV's Operations board."
        icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#99F6E4,#0D9488)" }}><ListTodo className="w-[22px] h-[22px] text-white" /></div>}
      />
      <div className="dgs-card p-4 sm:p-6">
        <TaskBoard />
      </div>
    </div>
  );
}
