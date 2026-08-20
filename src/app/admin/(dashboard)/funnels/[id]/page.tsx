import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { FunnelData } from "@/lib/funnel/types";
import { PageHero } from "@/components/admin/PageHero";
import { FunnelBuilder } from "@/components/admin/funnels/FunnelBuilder";

export const dynamic = "force-dynamic";

export default async function FunnelEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { id } = await params;
  const f = await prisma.funnel.findUnique({ where: { id } });
  if (!f) notFound();

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero title="Edit funnel" subtitle={`/f/${f.slug}`} backHref="/admin/funnels" />
      <FunnelBuilder initial={{ id: f.id, name: f.name, slug: f.slug, status: f.status, data: f.data as unknown as FunnelData }} />
    </div>
  );
}
