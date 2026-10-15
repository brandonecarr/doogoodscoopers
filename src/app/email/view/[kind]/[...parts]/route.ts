/**
 * Hosted "view in browser" copy of an email, personalized for its recipient.
 * Public, but only reachable with the signed link the email itself carries.
 * See src/lib/email-view.ts for the link format.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyViewSignature } from "@/lib/email-view";
import { renderTemplate } from "@/lib/resend";
import { personalizeHtml } from "@/lib/email-send";
import { decodeTemplateTokens } from "@/lib/campaign-email";
import { getLeadPersonalization, firstNameOf } from "@/lib/personalization";
import { unsubToken } from "@/lib/email-unsubscribe";
import type { LeadSource } from "@prisma/client";

export const dynamic = "force-dynamic";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://doogoodscoopers.vercel.app";
const LEAD_TYPES = new Set(["QUOTE_FORM", "AD_LEAD", "OUT_OF_AREA", "COMMERCIAL", "CAREERS", "CUSTOMER"]);

const page = (html: string, status = 200) =>
  new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" } });
const gone = (msg: string) => page(`<!doctype html><meta charset="utf-8"><title>DooGoodScoopers</title><body style="font-family:Arial,sans-serif;padding:40px;color:#3D5265"><h2 style="color:#0B1B2B">This email isn't available</h2><p>${msg}</p></body>`, 404);

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string; parts: string[] }> }) {
  const { kind, parts } = await ctx.params;
  const decoded = parts.map((p) => decodeURIComponent(p));
  if (!verifyViewSignature(kind, decoded, req.nextUrl.searchParams.get("s"))) return gone("The link isn't valid.");

  let html = "";
  let subject = "";
  let vars: Record<string, string> = {};
  let unsubUrl = `${SITE}/unsubscribe`;
  if (kind === "r") {
    const r = await prisma.emailRecipient.findUnique({ where: { id: decoded[0] } });
    if (!r) return gone("It may have been removed.");
    const c = await prisma.emailCampaign.findUnique({ where: { id: r.campaignId }, select: { html: true, subject: true } });
    if (!c) return gone("It may have been removed.");
    html = c.html; subject = c.subject;
    unsubUrl = `${SITE}/unsubscribe?token=${unsubToken(r.email)}`;
    vars = { firstName: firstNameOf(r.name || ""), name: r.name || "" };
  } else {
    const [stepId, leadType, leadId] = decoded;
    if (!LEAD_TYPES.has(leadType)) return gone("The link isn't valid.");
    const step = await prisma.campaignStep.findUnique({ where: { id: stepId }, select: { html: true, subject: true } });
    if (!step?.html) return gone("It may have been removed.");
    html = step.html; subject = step.subject || "";
    vars = await getLeadPersonalization(leadType as LeadSource, leadId, { channel: "email" });
    const email = await emailFor(leadType as LeadSource, leadId);
    if (email) unsubUrl = `${SITE}/unsubscribe?token=${unsubToken(email)}`;
  }
  // Same pipeline as the send, with the "view in browser" link pointing at this page.
  const all = { ...vars, unsubscribeUrl: unsubUrl, viewInBrowserUrl: "#" };
  const rendered = personalizeHtml(decodeTemplateTokens(html), all, unsubUrl)
    .replace(/<title><\/title>/i, `<title>${esc(renderTemplate(subject, all))}</title>`);
  return page(rendered);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function emailFor(leadType: LeadSource, leadId: string): Promise<string | null> {
  switch (leadType) {
    case "QUOTE_FORM": return (await prisma.quoteLead.findUnique({ where: { id: leadId }, select: { email: true } }))?.email ?? null;
    case "AD_LEAD": return (await prisma.adLead.findUnique({ where: { id: leadId }, select: { email: true } }))?.email ?? null;
    case "CUSTOMER": return (await prisma.sweepandgoCustomer.findUnique({ where: { id: leadId }, select: { email: true } }))?.email ?? null;
    default: return null;
  }
}
