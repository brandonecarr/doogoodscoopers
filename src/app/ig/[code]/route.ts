import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Tracked Instagram quote link: /ig/<trackingCode>
// Logs the click on the matching InstagramLead, then forwards to the real
// onboarding form. Kept dead-simple and best-effort so a DB hiccup never blocks
// the customer from reaching the quote form.

export const dynamic = "force-dynamic";

const DEST =
  process.env.INSTAGRAM_QUOTE_LINK ||
  "https://doogoodscoopers.com/sng/doogoodscoopers-obc2w-client-onboarding/";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const lead = await prisma.instagramLead.findUnique({ where: { trackingCode: code }, select: { id: true, linkClickedAt: true } });
    if (lead) {
      await prisma.instagramLead.update({
        where: { id: lead.id },
        data: { linkClickCount: { increment: 1 }, linkClickedAt: lead.linkClickedAt ?? new Date() },
      });
    }
  } catch {
    /* never block the redirect */
  }
  // Carry the code into Sweep&Go's `tracking_field` so the signup can be matched
  // back to this lead when it returns via the webhook / API sync.
  const dest = new URL(DEST);
  dest.searchParams.set("tracking_field", `ig_${code}`);
  return NextResponse.redirect(dest.toString(), 302);
}
