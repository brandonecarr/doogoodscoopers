"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Mail, MessageSquare, Loader2, Play, Pause, AlertTriangle, Check, Users, DollarSign } from "lucide-react";
import { PageHero, heroBtnPrimary, heroPrimaryStyle, heroBtnSecondary } from "@/components/admin/PageHero";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { WINBACK_CODE, WINBACK_FROM, winbackMessages } from "@/lib/winback-messages";
import type { WinbackCandidate, winbackStatus } from "@/lib/winback";

type Status = Awaited<ReturnType<typeof winbackStatus>>;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Next Tuesday at 10 AM (email opens are best mid-morning, mid-week). */
function defaultStart(): Date {
  const d = new Date();
  d.setDate(d.getDate() + (((2 - d.getDay() + 7) % 7) || 7));
  d.setHours(10, 0, 0, 0);
  return d;
}

export function WinbackManager({ status, candidates }: { status: Status; candidates: WinbackCandidate[] }) {
  return status ? <Progress status={status} /> : <Setup candidates={candidates} />;
}

function Hero({ actions }: { actions?: React.ReactNode }) {
  return (
    <PageHero
      title="Win-back"
      subtitle="Invite former customers back with 25% off their first month: 3 emails plus 2 texts."
      icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}><RotateCcw className="w-[22px] h-[22px] text-white" /></div>}
      actions={actions}
    />
  );
}

// ── Before launch ────────────────────────────────────────────────────────────────
function Setup({ candidates }: { candidates: WinbackCandidate[] }) {
  const router = useRouter();
  const start0 = useMemo(defaultStart, []);
  const [startAt, setStartAt] = useState(`${ymd(start0)}T10:00`);
  const [deadline, setDeadline] = useState(() => { const d = new Date(start0); d.setDate(d.getDate() + 12); return ymd(d); });
  const [signupLink, setSignupLink] = useState("");
  const [couponConfirmed, setCouponConfirmed] = useState(false);
  const [included, setIncluded] = useState<Set<string>>(() => new Set(candidates.filter((c) => c.defaultInclude).map((c) => c.id)));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = candidates.filter((c) => included.has(c.id));
  const emailCount = chosen.filter((c) => c.emailEligible).length;
  const textCount = chosen.filter((c) => c.smsEligible).length;
  const msgs = winbackMessages(deadline || ymd(new Date()), signupLink.trim() || "https://your-signup-link");
  const toggle = (id: string) => setIncluded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const launch = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/admin/winback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "launch", startAt, deadline, signupLink: signupLink.trim(), includeIds: [...included], couponConfirmed }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Launch failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const ready = !!signupLink.trim() && couponConfirmed && chosen.length > 0 && !!deadline && !!startAt;

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <Hero />
      {error && <div className="dgs-card p-3 border border-red-200 bg-red-50 text-red-700 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</div>}

      <div className="dgs-card p-5">
        <h2 className="text-[15px] font-extrabold text-ink mb-3">1. Setup</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-[13px] text-gray-600">First email goes out
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="text-[13px] text-gray-600">Offer's last day
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
          <label className="text-[13px] text-gray-600 md:col-span-2">Signup link (where they sign back up and enter the code)
            <input value={signupLink} onChange={(e) => setSignupLink(e.target.value)} placeholder="https://..." className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </label>
        </div>
        <label className="mt-3 flex items-start gap-2 text-[13px] text-gray-700">
          <input type="checkbox" checked={couponConfirmed} onChange={(e) => setCouponConfirmed(e.target.checked)} className="mt-0.5 accent-violet-600" />
          <span>I created the code <b className="font-mono">{WINBACK_CODE}</b> in Sweep&amp;Go (25% off the first month). The CRM can&apos;t create it, since it only reads from Sweep&amp;Go.</span>
        </label>
        <p className="text-[12px] text-gray-400 mt-2">Emails come from &ldquo;{WINBACK_FROM}&rdquo;. Texts go out between your messaging hours and stop if someone replies. Anyone who signs back up stops getting messages within about a minute.</p>
      </div>

      <div className="dgs-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-[15px] font-extrabold text-ink">2. Who gets it</h2>
          <span className="text-[12.5px] text-gray-500"><b className="text-ink">{chosen.length}</b> people · <Mail className="w-3.5 h-3.5 inline" /> {emailCount} emails · <MessageSquare className="w-3.5 h-3.5 inline" /> {textCount} texts</span>
        </div>
        <div className="max-h-[420px] overflow-auto border border-gray-100 rounded-lg">
          <table className="w-full text-[13px]">
            <thead className="bg-gray-50 text-gray-500 text-left sticky top-0"><tr>
              <th className="p-2 w-8"></th><th className="p-2">Name</th><th className="p-2">City</th><th className="p-2">Gets</th><th className="p-2">Notes</th>
            </tr></thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className={`border-t border-gray-100 ${included.has(c.id) ? "" : "opacity-50"}`}>
                  <td className="p-2"><input type="checkbox" checked={included.has(c.id)} onChange={() => toggle(c.id)} disabled={!c.emailEligible && !c.smsEligible} className="accent-violet-600" /></td>
                  <td className="p-2 font-medium text-ink">{c.name}</td>
                  <td className="p-2 text-gray-500">{c.city || "—"}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      {c.emailEligible && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold">Email</span>}
                      {c.smsEligible && <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[11px] font-semibold">Text</span>}
                    </div>
                  </td>
                  <td className="p-2 text-[12px] text-gray-500">
                    {[c.farAway && `~${c.milesToNearestCustomer} mi from your nearest customer`, c.unsubscribed && "unsubscribed from email", c.optedOut && "texted STOP",
                      c.smsDeclined && "declined texts", !c.phone && "no phone number"].filter(Boolean).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dgs-card p-5">
        <h2 className="text-[15px] font-extrabold text-ink mb-3">3. The messages <span className="text-[12px] font-normal text-gray-400">(shown for &ldquo;Karen&rdquo;)</span></h2>
        <div className="space-y-3">
          {[
            ...msgs.emails.map((m) => ({ day: m.day, kind: "email" as const, subject: m.subject, html: m.html })),
            ...msgs.texts.map((t) => ({ day: t.day, kind: "text" as const, subject: "", html: t.body })),
          ].sort((a, b) => a.day - b.day).map((m) => (
            <div key={`${m.kind}-${m.day}`} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2 text-[12px] text-gray-500 mb-1.5">
                <span className="font-bold text-ink">Day {m.day}</span>
                {m.kind === "email" ? <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">Email · {emailCount}</span> : <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-semibold">Text · {textCount}</span>}
                {m.subject && <span className="font-semibold text-gray-700">{m.subject.replace("{{firstName}}", "Karen")}</span>}
              </div>
              {m.kind === "email"
                ? <iframe title={`Email day ${m.day}`} srcDoc={m.html.replaceAll("{{firstName}}", "Karen")} className="w-full h-[300px] border-0 bg-white rounded" sandbox="" />
                : <p className="text-[14px] text-ink bg-gray-50 rounded-lg p-2.5">{m.html.replaceAll("{{firstName}}", "Karen")}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="dgs-card p-5 flex items-center justify-between gap-3 flex-wrap">
        {confirming ? (
          <>
            <p className="text-[13.5px] text-ink">Start sending to <b>{chosen.length}</b> people on <b>{formatDateTime(new Date(startAt), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</b>, with the offer ending <b>{formatDate(new Date(`${deadline}T12:00`), { month: "short", day: "numeric" })}</b>?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className={heroBtnSecondary}>Cancel</button>
              <button onClick={launch} disabled={busy} className={heroBtnPrimary} style={heroPrimaryStyle}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Yes, launch</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-gray-500">{ready ? "Ready when you are." : "Add the signup link and confirm the coupon code to launch."}</p>
            <button onClick={() => setConfirming(true)} disabled={!ready} className={`${heroBtnPrimary} disabled:opacity-50`} style={heroPrimaryStyle}><Play className="w-4 h-4" />Launch win-back</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── After launch ────────────────────────────────────────────────────────────────
function Progress({ status }: { status: NonNullable<Status> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    await fetch("/api/admin/winback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: status.running ? "pause" : "resume" }) }).catch(() => {});
    setBusy(false);
    router.refresh();
  };
  const t = status.totals;
  const tiles = [
    { label: "Came back", value: String(t.cameBack), icon: RotateCcw, tint: "text-green-700" },
    { label: "Won back / month", value: `$${Math.round(t.monthlyRevenue).toLocaleString()}`, icon: DollarSign, tint: "text-green-700" },
    { label: "Emails sent", value: `${t.emailsSent} / ${t.emailRecipients * 3}`, icon: Mail, tint: "text-blue-700" },
    { label: "Texts sent", value: `${t.textsSent} / ${t.textRecipients * 2}`, icon: MessageSquare, tint: "text-green-700" },
  ];
  const progress = (p: { status: string; sent: number; total: number; error: string | null } | null) =>
    !p ? <span className="text-gray-300">—</span>
      : <span className={p.status === "STOPPED" ? "text-gray-400" : "text-ink"} title={p.error || undefined}>{p.sent}/{p.total}{p.status === "STOPPED" ? ` · stopped${p.error ? ` (${p.error})` : ""}` : p.status === "COMPLETED" ? " · done" : ""}</span>;

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <Hero actions={
        <button onClick={toggle} disabled={busy} className={heroBtnSecondary}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : status.running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="hidden sm:inline">{status.running ? "Pause sending" : "Resume sending"}</span>
        </button>
      } />
      <div className="dgs-card p-4 text-[13px] text-gray-600 flex flex-wrap gap-x-5 gap-y-1">
        <span className={`font-semibold ${status.running ? "text-green-700" : "text-amber-700"}`}>{status.running ? "● Running" : "❚❚ Paused"}</span>
        <span>Started {formatDateTime(status.config.startAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        <span>Offer ends {formatDate(`${status.config.deadline}T12:00`, { month: "short", day: "numeric" })}</span>
        <span>Code <b className="font-mono">{WINBACK_CODE}</b></span>
        <a href={status.config.signupLink} target="_blank" rel="noreferrer" className="text-violet-700 underline truncate max-w-[260px]">{status.config.signupLink}</a>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((x) => (
          <div key={x.label} className="dgs-card p-4">
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500"><x.icon className={`w-4 h-4 ${x.tint}`} />{x.label}</div>
            <div className="text-[24px] font-extrabold text-ink mt-1">{x.value}</div>
          </div>
        ))}
      </div>
      <div className="dgs-card p-5">
        <h2 className="text-[15px] font-extrabold text-ink mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Everyone in the campaign · {status.people.length}</h2>
        <div className="overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="text-gray-500 text-left"><tr><th className="p-2">Name</th><th className="p-2">City</th><th className="p-2">Emails</th><th className="p-2">Texts</th><th className="p-2">Came back</th></tr></thead>
            <tbody>
              {status.people.map((p) => (
                <tr key={p.id} className={`border-t border-gray-100 ${p.cameBack ? "bg-green-50/60" : ""}`}>
                  <td className="p-2 font-medium text-ink">{p.name}</td>
                  <td className="p-2 text-gray-500">{p.city || "—"}</td>
                  <td className="p-2">{progress(p.email)}</td>
                  <td className="p-2">{progress(p.text)}</td>
                  <td className="p-2">{p.cameBack
                    ? <span className="text-green-700 font-semibold">Yes{p.cameBackAt ? `, ${formatDate(p.cameBackAt, { month: "short", day: "numeric" })}` : ""}{p.monthlyRevenue ? ` · $${Math.round(p.monthlyRevenue)}/mo` : ""}</span>
                    : <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
