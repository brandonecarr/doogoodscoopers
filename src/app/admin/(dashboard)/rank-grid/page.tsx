import { redirect } from "next/navigation";
import { Grid3x3 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { PageHero } from "@/components/admin/PageHero";
import { RankGrid } from "@/components/admin/RankGrid";

export const dynamic = "force-dynamic";

export default async function RankGridPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const hasPlacesKey = Boolean(
    process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  );

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Local Rank Grid"
        subtitle="Where you rank across a city, sampled from dozens of points — not one number"
        backHref="/admin/reviews"
        icon={
          <div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
            <Grid3x3 className="w-[22px] h-[22px] text-white" />
          </div>
        }
      />

      {!hasPlacesKey && (
        <div className="dgs-card p-4 text-[13px] text-amber-900 bg-amber-50 border border-amber-100">
          No Google Maps API key is configured for this deployment, so scans can&apos;t run.
        </div>
      )}

      <RankGrid token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} defaultBusiness="DooGoodScoopers" />
    </div>
  );
}
