import { requireCanvasserAccess } from "@/lib/auth-supabase";
import { CanvasserMap } from "@/components/portals/canvasser/CanvasserMap";

export const dynamic = "force-dynamic";

export default async function CanvasserMapPage() {
  await requireCanvasserAccess();
  return <CanvasserMap token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />;
}
