import { redirect } from "next/navigation";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import { CanvasserMap } from "@/components/portals/canvasser/CanvasserMap";

export const dynamic = "force-dynamic";

export default async function CanvasserMapPage() {
  const session = await getCanvasserSession();
  if (!session) redirect("/canvasser/login");
  return <CanvasserMap token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} />;
}
