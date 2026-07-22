"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function UnsubscribePage() {
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function go() {
    setState("loading");
    try {
      const res = await fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });
      const d = await res.json();
      setState(d.success ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        {state === "done" ? (
          <>
            <h1 className="text-xl font-bold text-navy-900">You&apos;re unsubscribed</h1>
            <p className="text-gray-500 mt-2 text-sm">You won&apos;t receive further marketing emails from DooGoodScoopers.</p>
          </>
        ) : state === "error" ? (
          <>
            <h1 className="text-xl font-bold text-navy-900">Something went wrong</h1>
            <p className="text-gray-500 mt-2 text-sm">This link may have expired. Please use the unsubscribe link from a recent email.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-navy-900">Unsubscribe</h1>
            <p className="text-gray-500 mt-2 text-sm">Stop receiving marketing emails from DooGoodScoopers?</p>
            <button
              onClick={go}
              disabled={!token || state === "loading"}
              className="mt-5 px-5 py-2.5 bg-navy-600 text-white rounded-lg hover:bg-navy-700 disabled:opacity-50 text-sm font-medium"
            >
              {state === "loading" ? "Unsubscribing…" : "Unsubscribe me"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
