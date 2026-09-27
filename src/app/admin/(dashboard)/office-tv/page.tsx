import { redirect } from "next/navigation";
import { Tv } from "lucide-react";
import { getSession } from "@/lib/auth";
import { PageHero } from "@/components/admin/PageHero";
import { OfficeTvEditor } from "@/components/admin/office-tv/OfficeTvEditor";

export const dynamic = "force-dynamic";

export default async function OfficeTvPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Office TV"
        subtitle="What the Growth Board shows: the goal, the boards and their sections, and the pipeline stages."
        icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#A9C6FB,#2F7BF6)" }}><Tv className="w-[22px] h-[22px] text-white" /></div>}
      />
      <OfficeTvEditor />
    </div>
  );
}
