import webPush from "web-push";
import prisma from "@/lib/prisma";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  renotify?: boolean;
}

/**
 * Send a push notification to all stored admin subscriptions.
 * Automatically removes expired/invalid subscriptions (HTTP 410/404).
 */
export async function sendAdminPush(payload: PushPayload) {
  // Initialize lazily so env vars are read at runtime, not build time
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[web-push] VAPID keys not configured — skipping push");
    return { sent: 0, failed: 0 };
  }
  webPush.setVapidDetails("mailto:service@doogoodscoopers.com", publicKey, privateKey);
  const subs = await prisma.adminPushSubscription.findMany();

  if (subs.length === 0) return { sent: 0, failed: 0 };

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          // Subscription expired — remove it
          await prisma.adminPushSubscription.deleteMany({
            where: { endpoint: sub.endpoint },
          });
        }
        throw err;
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  return { sent, failed };
}
