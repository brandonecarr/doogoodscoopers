import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { DripForm, type DelayUnit } from "@/components/admin/DripForm";
import { BlastEditForm } from "@/components/admin/BlastEditForm";

function minutesToStep(min: number): { delayValue: number; delayUnit: DelayUnit } {
  if (min > 0 && min % 1440 === 0) return { delayValue: min / 1440, delayUnit: "days" };
  if (min > 0 && min % 60 === 0) return { delayValue: min / 60, delayUnit: "hours" };
  return { delayValue: min, delayUnit: "minutes" };
}

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });
  if (!campaign) notFound();

  if (campaign.type === "DRIP") {
    const leadTypes = ((campaign.audienceFilter as { leadTypes?: string[] } | null)?.leadTypes) || [];
    const steps = campaign.steps.map((s) => ({ body: s.body, ...minutesToStep(s.delayMinutes) }));
    if (steps.length === 0) steps.push({ body: "", delayValue: 0, delayUnit: "days" });
    return (
      <DripForm
        mode="edit"
        campaignId={campaign.id}
        initial={{ name: campaign.name, leadTypes, stopOnReply: campaign.stopOnReply, steps }}
      />
    );
  }

  return <BlastEditForm campaignId={campaign.id} initialName={campaign.name} initialBody={campaign.body} />;
}
