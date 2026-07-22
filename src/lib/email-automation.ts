import prisma from "@/lib/prisma";
import { unsubscribedSet, normalizeEmail } from "@/lib/email-unsubscribe";

// Enrollment for email automations: NEW contacts (created after the automation
// started) of the trigger type(s), excluding unsubscribed + already-enrolled.

export interface AutomationCandidate { contactType: string; contactId: string; email: string; name: string | null }

interface AutomationLite { id: string; createdAt: Date; trigger: unknown }

export async function findAutomationCandidates(automation: AutomationLite): Promise<AutomationCandidate[]> {
  const types = new Set(((automation.trigger as { types?: string[] } | null)?.types) || []);
  if (types.size === 0) return [];
  const since = automation.createdAt;
  const out: AutomationCandidate[] = [];

  if (types.has("new_subscribers")) {
    const rows = await prisma.emailContact.findMany({ where: { status: "SUBSCRIBED", createdAt: { gt: since } }, select: { id: true, email: true, firstName: true, lastName: true } });
    for (const r of rows) out.push({ contactType: "subscriber", contactId: r.id, email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null });
  }
  if (types.has("new_customers")) {
    const rows = await prisma.sweepandgoCustomer.findMany({ where: { active: true, email: { not: null }, firstSeenAt: { gt: since } }, select: { id: true, email: true, firstName: true, lastName: true } });
    for (const r of rows) if (r.email) out.push({ contactType: "customer", contactId: r.id, email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null });
  }
  if (types.has("former_customers")) {
    const rows = await prisma.sweepandgoCustomer.findMany({ where: { active: false, email: { not: null }, removedAt: { gt: since } }, select: { id: true, email: true, firstName: true, lastName: true } });
    for (const r of rows) if (r.email) out.push({ contactType: "former_customer", contactId: r.id, email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null });
  }
  if (types.has("quote")) {
    const rows = await prisma.quoteLead.findMany({ where: { archived: false, email: { not: null }, createdAt: { gt: since } }, select: { id: true, email: true, firstName: true, lastName: true } });
    for (const r of rows) if (r.email) out.push({ contactType: "quote", contactId: r.id, email: r.email, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null });
  }
  if (types.has("ad")) {
    const rows = await prisma.adLead.findMany({ where: { archived: false, email: { not: null }, createdAt: { gt: since } }, select: { id: true, email: true, firstName: true, lastName: true, fullName: true } });
    for (const r of rows) if (r.email) out.push({ contactType: "ad", contactId: r.id, email: r.email, name: r.fullName || [r.firstName, r.lastName].filter(Boolean).join(" ") || null });
  }

  const enrolled = await prisma.emailAutomationRecipient.findMany({ where: { automationId: automation.id }, select: { contactType: true, contactId: true } });
  const enrolledSet = new Set(enrolled.map((e) => `${e.contactType}:${e.contactId}`));
  const unsub = await unsubscribedSet();
  const seen = new Set<string>();
  return out.filter((c) => {
    const key = normalizeEmail(c.email);
    if (!key.includes("@") || unsub.has(key)) return false;
    if (enrolledSet.has(`${c.contactType}:${c.contactId}`) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
