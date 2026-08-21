"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Map as MapIcon, ListChecks, List as ListIcon, LogOut, Wifi, WifiOff, CloudUpload } from "lucide-react";
import { startOutbox, getQueueCount, processOutbox } from "@/lib/pwa/canvasser-outbox";

// Canvasser portal shell: top bar (rep name, connection + queued-writes status,
// sign out) and a two-tab nav (Map / My Leads). Boots the offline outbox.
export function CanvasserChrome({ user, children }: { user: { name: string; email: string }; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    startOutbox();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/canvasser-sw.js", { scope: "/app/canvasser" }).catch(() => {});
    }
    setOnline(navigator.onLine);
    getQueueCount().then(setQueued).catch(() => {});
    const on = () => { setOnline(true); void processOutbox(); };
    const off = () => setOnline(false);
    const onQueue = (e: Event) => setQueued((e as CustomEvent).detail as number);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("canvasser-queue-changed", onQueue);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("canvasser-queue-changed", onQueue);
    };
  }, []);

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/canvasser/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/canvasser/login");
    router.refresh();
  };

  const name = user.name || user.email;
  const tabs = [
    { href: "/app/canvasser", label: "Map", icon: MapIcon },
    { href: "/app/canvasser/list", label: "List", icon: ListIcon },
    { href: "/app/canvasser/my-leads", label: "My Leads", icon: ListChecks },
  ];
  const active = (href: string) => (href === "/app/canvasser" ? pathname === href : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-[#0E2A47] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-bold truncate">{name}</p>
          <p className="text-[10.5px] text-white/60">Canvasser</p>
        </div>
        <div className="flex items-center gap-2">
          {queued > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-400/20 text-amber-200 rounded-full px-2 py-1">
              <CloudUpload className="w-3.5 h-3.5" /> {queued}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-1 ${online ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200"}`}>
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {online ? "Online" : "Offline"}
          </span>
          <button onClick={logout} disabled={loggingOut} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-3">{children}</main>

      <nav className="sticky bottom-0 z-30 bg-white border-t border-gray-200 grid grid-cols-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = active(t.href);
          return (
            <Link key={t.href} href={t.href} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold" style={{ color: on ? "#6D3EF0" : "#6B7280" }}>
              <Icon className="w-5 h-5" /> {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
