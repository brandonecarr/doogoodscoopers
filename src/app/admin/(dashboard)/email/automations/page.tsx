import Link from "next/link";
import { ArrowLeft, Plus, Zap } from "lucide-react";
import prisma from "@/lib/prisma";
import AutomationsList from "@/components/admin/AutomationsList";

export const dynamic = "force-dynamic";

const TRIGGER_LABELS: Record<string, string> = {
  new_subscribers: "New subscribers",
  new_customers: "New customers",
  former_customers: "Former customers",
  quote: "Quote leads",
  ad: "Meta leads",
};

export default async function EmailAutomationsPage() {
  const automations = await prisma.emailAutomation.findMany({ orderBy: { createdAt: "desc" } });
  const rows = await Promise.all(
    automations.map(async (a) => {
      const trigger = (a.trigger as { types?: string[] } | null) || {};
      const types = (trigger.types || []).map((t) => TRIGGER_LABELS[t] || t);
      return {
        id: a.id,
        name: a.name,
        active: a.active,
        triggerLabels: types,
        stepCount: await prisma.emailAutomationStep.count({ where: { automationId: a.id } }),
        activeCount: await prisma.emailAutomationRecipient.count({ where: { automationId: a.id, status: "ACTIVE" } }),
        sentCount: a.sentCount,
      };
    })
  );

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/email" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-gray-600" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Automations</h1>
            <p className="text-navy-600 text-sm mt-1">Set-and-forget email sequences that enroll new contacts automatically.</p>
          </div>
        </div>
        <Link href="/admin/email/automations/new" className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium">
          <Plus className="w-4 h-4" />
          New Automation
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No automations yet.</p>
          <Link href="/admin/email/automations/new" className="text-teal-600 text-sm font-medium hover:underline mt-2 inline-block">Create a welcome or win-back drip →</Link>
        </div>
      ) : (
        <AutomationsList rows={rows} />
      )}
    </div>
  );
}
