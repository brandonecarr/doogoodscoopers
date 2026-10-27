import { PhoneCall } from "lucide-react";
import { PageHero, heroBtnSecondary } from "@/components/admin/PageHero";
import { SonaPlaybookEditor } from "@/components/admin/SonaPlaybookEditor";

export const dynamic = "force-dynamic";

/** What Sona says on an outbound call, per lead type, as a branching playbook. */
export default function SonaPlaybooksPage() {
  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Sona playbooks"
        subtitle="What Sona says when you press “Have Sona call” on a lead. Quo gives Sona one written instruction per call, so the branches you write here become that instruction."
        icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#99F6E4,#0D9488)" }}><PhoneCall className="w-[22px] h-[22px] text-white" /></div>}
        actions={<a href="/admin/settings#sona" className={heroBtnSecondary}>Connection &amp; limits</a>}
      />
      <SonaPlaybookEditor />
    </div>
  );
}
