"use client";

import { useEffect } from "react";

export function AdminPushProvider() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    async function setupPush() {
      try {
        const reg = await navigator.serviceWorker.register("/admin-sw.js", {
          scope: "/admin/",
        });

        await navigator.serviceWorker.ready;

        // Check if already subscribed
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;

        // Ask for permission (only prompts if not already decided)
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // Subscribe — pass VAPID key as a string; the browser accepts
        // both base64url strings and BufferSource for applicationServerKey
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey as string,
        });

        // Save to server
        const json = subscription.toJSON();
        await fetch("/api/admin/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
          }),
        });
      } catch (err) {
        console.error("[AdminPush] Setup failed:", err);
      }
    }

    setupPush();
  }, []);

  return null;
}
