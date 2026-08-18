"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2 } from "lucide-react";

export default function CanvasserLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/canvasser/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Couldn't sign in."); return; }
      router.push("/app/canvasser");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E2A47] px-5">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
            <MapPin className="w-5 h-5 text-white" />
          </span>
          <div>
            <p className="text-[15px] font-extrabold text-ink leading-none">Canvasser</p>
            <p className="text-[11px] text-muted mt-1">DooGoodScoopers</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent" />
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent" />
          {error && <p className="text-[12.5px] text-rose-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white disabled:opacity-60" style={{ background: "#6D3EF0" }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
