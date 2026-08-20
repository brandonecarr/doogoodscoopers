import { notFound } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import type { FunnelData } from "@/lib/funnel/types";
import { FunnelRunner } from "@/components/funnel/FunnelRunner";
import { MetaPixel } from "@/components/funnel/MetaPixel";

export const dynamic = "force-dynamic";

async function getFunnel(slug: string) {
  return prisma.funnel.findFirst({ where: { slug, status: "published" } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = await getFunnel(slug);
  const settings = (f?.data as unknown as FunnelData | undefined)?.settings;
  const title = settings?.metaTitle || f?.name || "Get a Quote";
  return { title: `${title} · DooGoodScoopers`, robots: { index: false } };
}

export default async function FunnelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await getFunnel(slug);
  if (!f) notFound();
  const data = f.data as unknown as FunnelData;
  if (!data?.variants?.A?.steps?.length) notFound();
  return (
    <>
      <MetaPixel pixelId={process.env.NEXT_PUBLIC_META_PIXEL_ID} />
      <FunnelRunner funnelId={f.id} slug={f.slug} data={data} />
    </>
  );
}
