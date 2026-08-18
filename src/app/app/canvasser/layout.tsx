import type { Metadata } from "next";
import { requireCanvasserAccess } from "@/lib/auth-supabase";
import { CanvasserChrome } from "@/components/portals/canvasser/CanvasserChrome";

export const metadata: Metadata = {
  manifest: "/canvasser-manifest.json",
};

export default async function CanvasserLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCanvasserAccess();
  return <CanvasserChrome user={user}>{children}</CanvasserChrome>;
}
