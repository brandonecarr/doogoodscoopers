import { redirect } from "next/navigation";
import { Calculator } from "lucide-react";
import { getSession } from "@/lib/auth";
import { PageHero } from "@/components/admin/PageHero";
import { CommunityQuoteCalculator } from "@/components/admin/CommunityQuoteCalculator";

export const dynamic = "force-dynamic";

export default async function CommunityQuotePage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Community Quote"
        subtitle="Price an HOA / condo community by area & frequency — with a per-unit breakdown to pitch the board"
        backHref="/admin/commercial"
        icon={
          <div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
            <Calculator className="w-[22px] h-[22px] text-white" />
          </div>
        }
      />
      <CommunityQuoteCalculator mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />
    </div>
  );
}
