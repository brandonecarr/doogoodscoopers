import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import { CanvasserChrome } from "@/components/portals/canvasser/CanvasserChrome";

export const metadata: Metadata = {
  manifest: "/canvasser-manifest.json",
};

export default async function CanvasserLayout({ children }: { children: React.ReactNode }) {
  const session = await getCanvasserSession();
  if (!session) redirect("/canvasser/login");
  return <CanvasserChrome user={{ name: session.name, email: session.email }}>{children}</CanvasserChrome>;
}
