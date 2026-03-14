import webPush from "web-push";
import prisma from "@/lib/prisma";

webPush.setVapidDetails(
  "mailto:service@doogoodscoopers.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

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
