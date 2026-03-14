"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

export function AdminPushProvider() {
  const [showBanner, setShowBanner] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (
      !vapidKey ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    async function init() {
      try {
        const registration = await navigator.serviceWorker.register(
          "/admin-sw.js",
          { scope: "/admin/" }
        );
        setReg(registration);

        // Wait for the SW to become active
        await waitForActivation(registration);

        const existing = await registration.pushManager.getSubscription();

        if (existing) {
          // Already subscribed — ensure server has it saved
          return;
        }

        if (Notification.permission === "granted") {
          // Permission already granted (e.g. previous session) — subscribe silently
          await doSubscribe(registration);
        } else if (Notification.permission === "default") {
          // Not asked yet — show the enable button
          setShowBanner(true);
        }
        // "denied" — respect the choice, stay quiet
      } catch (err) {
        console.error("[AdminPush] Init error:", err);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vapidKey]);

  async function waitForActivation(registration: ServiceWorkerRegistration) {
    if (registration.active) return;

    return new Promise<void>((resolve) => {
      const sw = registration.installing ?? registration.waiting;
      if (!sw) { resolve(); return; }

      sw.addEventListener("statechange", function handler() {
        if (sw.state === "activated") {
          sw.removeEventListener("statechange", handler);
          resolve();
        }
      });

      // Fallback in case events fire before we listen
      setTimeout(resolve, 4000);
    });
  }

  async function doSubscribe(registration: ServiceWorkerRegistration) {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey as string,
    });
    const json = subscription.toJSON();
    await fetch("/api/admin/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
  }

  // Called by the button — runs inside a user gesture so iOS will show the prompt
  async function handleEnable() {
    if (!reg || subscribing) return;
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      // Hide the banner as soon as the user responds to the prompt,
      // regardless of whether the subscription step succeeds.
      setShowBanner(false);
      if (permission === "granted") {
        await doSubscribe(reg);
      }
    } catch (err) {
      console.error("[AdminPush] Permission request failed:", err);
      setShowBanner(false);
    } finally {
      setSubscribing(false);
    }
  }

  function handleDismiss() {
    setShowBanner(false);
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:w-80">
      <div className="bg-navy-900 text-white rounded-xl shadow-xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bell className="w-4 h-4 text-teal-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Enable Notifications</p>
          <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
            Get alerts when followups are due or overdue.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleEnable}
              disabled={subscribing}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
            >
              {subscribing ? "Enabling…" : "Enable"}
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-white/40 hover:text-white/70 transition-colors"
              aria-label="Dismiss"
            >
              <BellOff className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
