import prisma from "@/lib/prisma";
import { sendAdminPush } from "@/lib/web-push";

/**
 * Admin notifications — the bell in the header.
 *
 * Anything the owner needs to know about as it happens: a message that couldn't
 * be delivered, a lead created from a phone call, Quo running out of credits.
 * Writing one never throws; a notification failing must not take down the
 * operation that triggered it.
 */

export type NotifyType = "delivery_failed" | "lead_created" | "lead_replied" | "credits" | "system";
export type NotifySeverity = "info" | "warning" | "error";

export interface NotifyInput {
  type: NotifyType;
  title: string;
  body?: string;
  link?: string;
  severity?: NotifySeverity;
  /**
   * Stable key for a recurring condition. Re-notifying with the same key
   * refreshes the existing row and marks it unread again instead of stacking
   * duplicates — e.g. "credits" should nag once, not once per failed message.
   */
  dedupeKey?: string;
  /** Also fire a push notification to the owner's phone. */
  push?: boolean;
}

export async function notify(input: NotifyInput): Promise<void> {
  const { type, title, body, link, severity = "info", dedupeKey, push } = input;
  try {
    if (dedupeKey) {
      await prisma.adminNotification.upsert({
        where: { dedupeKey },
        create: { type, severity, title, body, link, dedupeKey },
        // Resurface it: newest info, unread again.
        update: { type, severity, title, body, link, readAt: null, createdAt: new Date() },
      });
    } else {
      await prisma.adminNotification.create({ data: { type, severity, title, body, link } });
    }
  } catch (e) {
    console.error("[notify] failed to record notification:", e);
  }

  if (push) {
    sendAdminPush({ title, body: body || "", url: link || "/admin", tag: dedupeKey || type }).catch(() => {});
  }
}
