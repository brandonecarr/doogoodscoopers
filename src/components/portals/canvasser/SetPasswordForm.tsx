"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/canvasser/auth/set-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Couldn't set your password."); return; }
      router.push("/app/canvasser");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-[12.5px] text-muted">Setting the password for <b className="text-ink">{email}</b></p>
      <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 8 chars)" autoComplete="new-password"
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent" />
      <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password"
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-transparent" />
      {error && <p className="text-[12.5px] text-rose-600">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-bold text-white disabled:opacity-60" style={{ background: "#6D3EF0" }}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Set password &amp; sign in
      </button>
    </form>
  );
}
