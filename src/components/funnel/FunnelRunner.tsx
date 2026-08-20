"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ArrowLeft, Check, MapPin } from "lucide-react";
import type { FunnelData, Step, Block, FunnelAnswers, BranchRule } from "@/lib/funnel/types";
import { DEFAULT_BOOKING_URL } from "@/lib/funnel/types";

// The funnel wizard: walks steps, evaluates branch logic, calls check-zip /
// get-pricing, logs per-step events, and submits the lead. Reused JSON renderer
// so the builder's live preview and this public page stay identical.

interface Pricing {
  perVisit?: number | null; monthly?: number | null; initialFee?: number | null;
  oneTime?: boolean; zipType?: string | null; priceNotConfigured?: boolean;
}

const cookie = (n: string) =>
  typeof document === "undefined" ? undefined
    : document.cookie.split("; ").find((c) => c.startsWith(n + "="))?.split("=")[1];

export function FunnelRunner({
  funnelId, slug, data, variant = "A", preview = false,
}: { funnelId: string; slug: string; data: FunnelData; variant?: "A" | "B"; preview?: boolean }) {
  const steps = useMemo(
    () => (variant === "B" && data.variants.B ? data.variants.B.steps : data.variants.A.steps),
    [data, variant],
  );
  const primary = data.theme?.primary || "#6D3EF0";
  const bg = data.theme?.bg || "#0E2A47";
  const bookingUrl = data.settings?.bookingUrl || DEFAULT_BOOKING_URL;

  const idx = (id: string) => steps.findIndex((s) => s.id === id);
  const [currentId, setCurrentId] = useState(steps[0]?.id ?? "");
  const [history, setHistory] = useState<string[]>([]);
  const [answers, setAnswers] = useState<FunnelAnswers>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [price, setPrice] = useState<Pricing | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const attrRef = useRef<Record<string, unknown>>({});
  const completedRef = useRef(false);

  const cur = steps.find((s) => s.id === currentId) || steps[0];
  const money = (n?: number) => (typeof n === "number" ? `$${n % 1 === 0 ? n : n.toFixed(2)}` : "—");

  const logEvent = (type: string, step: string, payload?: Record<string, unknown>) => {
    if (preview || !sessionId) return;
    fetch("/api/v2/funnel/event", {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ sessionId, funnelId, variant, step, type, payload }),
    }).catch(() => {});
  };

  // Start session + capture attribution.
  useEffect(() => {
    if (preview) return;
    const p = new URLSearchParams(window.location.search);
    attrRef.current = {
      ig: p.get("ig") || undefined,
      utm_source: p.get("utm_source") || undefined,
      utm_medium: p.get("utm_medium") || undefined,
      utm_campaign: p.get("utm_campaign") || undefined,
      fbclid: p.get("fbclid") || undefined,
      gclid: p.get("gclid") || undefined,
      fbp: cookie("_fbp"),
      fbc: cookie("_fbc"),
      referrer: document.referrer || undefined,
    };
    if (p.get("ig")) setAnswers((a) => ({ ...a, igTracking: p.get("ig")! }));
    fetch("/api/v2/funnel/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnelId, slug, variant, attribution: attrRef.current }),
    }).then((r) => r.json()).then((d) => setSessionId(d.sessionId)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log a view whenever the step changes.
  useEffect(() => { if (sessionId && cur) logEvent("view", cur.id); /* eslint-disable-next-line */ }, [sessionId, currentId]);

  // Abandon on unload (best-effort).
  useEffect(() => {
    if (preview) return;
    const onHide = () => {
      if (completedRef.current || !sessionId) return;
      const body = JSON.stringify({ sessionId, funnelId, variant, step: currentId, type: "abandon" });
      navigator.sendBeacon?.("/api/v2/funnel/event", new Blob([body], { type: "application/json" }));
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [sessionId, currentId, preview, funnelId, variant]);

  // Fetch a price whenever we land on a step that shows one.
  useEffect(() => {
    if (!cur?.blocks.some((b) => b.type === "priceEstimate")) return;
    if (!answers.zipCode || !answers.numberOfDogs || !answers.frequency) { setPrice(null); return; }
    setPriceLoading(true);
    const qs = new URLSearchParams({
      zipCode: answers.zipCode, numberOfDogs: answers.numberOfDogs, frequency: answers.frequency,
      ...(answers.lastCleaned ? { lastCleaned: answers.lastCleaned } : {}),
    });
    fetch(`/api/v2/funnel/pricing?${qs}`).then((r) => r.json())
      .then((d) => setPrice(d?.pricing ?? null)).catch(() => setPrice(null)).finally(() => setPriceLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const matches = (rule: BranchRule, ans: FunnelAnswers) => {
    const v = ans[rule.field];
    if (rule.op === "eq") return v === rule.value;
    if (rule.op === "neq") return v !== rule.value;
    return Array.isArray(rule.value) && v != null && rule.value.includes(v);
  };
  const resolveNext = (step: Step, ans: FunnelAnswers): string | null => {
    for (const rule of step.logic || []) {
      if (matches(rule, ans)) return rule.goto === "@finish" ? steps[steps.length - 1].id : rule.goto;
    }
    const i = idx(step.id);
    return i >= 0 && i < steps.length - 1 ? steps[i + 1].id : null;
  };
  const advance = (ans?: FunnelAnswers) => {
    const eff = ans ?? answers;
    const nextId = resolveNext(cur, eff);
    if (!nextId) return;
    logEvent("next", cur.id);
    setHistory((h) => [...h, cur.id]);
    setCurrentId(nextId);
  };
  const goBack = () => setHistory((h) => {
    const copy = [...h]; const prev = copy.pop();
    if (prev) { logEvent("back", cur.id); setCurrentId(prev); }
    return copy;
  });
  const setAnswer = (field: string, value: string) => setAnswers((a) => ({ ...a, [field]: value }));

  const checkZip = async () => {
    const zip = (answers.zipCode || "").trim();
    if (!/^\d{5}$/.test(zip)) { setZipError("Please enter a valid 5-digit ZIP code."); return; }
    setZipLoading(true); setZipError("");
    // Auto-retry transient failures (cold starts etc.) so a blip never blocks a
    // real visitor. Only a definitive 200 + inServiceArea:boolean counts.
    let d: { inServiceArea: boolean; pricingZone?: string } | null = null;
    for (let attempt = 0; attempt < 3 && !d; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
      try {
        const res = await fetch("/api/v2/funnel/check-zip", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ zipCode: zip }),
        });
        if (res.ok) {
          const j = await res.json().catch(() => null);
          if (j && typeof j.inServiceArea === "boolean") d = j;
        }
      } catch { /* retry */ }
    }
    setZipLoading(false);
    if (!d) { setZipError("We couldn't check that ZIP just now. Please try again."); return; }
    const next: FunnelAnswers = { ...answers, zipCode: zip, inServiceArea: String(d.inServiceArea), pricingZone: d.pricingZone || "" };
    setAnswers(next);
    logEvent("answer", cur.id, { zip, inServiceArea: d.inServiceArea });
    if (!d.inServiceArea) logEvent("outofarea", cur.id, { zip });
    advance(next);
  };

  const selectChoice = (field: string, value: string) => {
    const next = { ...answers, [field]: value };
    setAnswers(next);
    logEvent("answer", cur.id, { [field]: value });
    advance(next);
  };

  const submitFunnel = async () => {
    setFormError("");
    if (!answers.phone || !/\d{7}/.test(answers.phone)) { setFormError("Please enter a valid phone number."); return; }
    const inArea = answers.inServiceArea !== "false";
    if (inArea && !answers.firstName) { setFormError("Please enter your name."); return; }
    if (preview) { completedRef.current = true; advance(); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v2/funnel/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, funnelId, variant, step: cur.id, answers }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(d.error || "Something went wrong. Please try again."); return; }
      completedRef.current = true;
      advance();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally { setSubmitting(false); }
  };

  const btn = (label: string, onClick: () => void, disabled = false, busy = false) => (
    <button onClick={onClick} disabled={disabled || busy}
      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[15px] font-bold text-white transition-transform active:scale-[.99] disabled:opacity-60"
      style={{ background: primary }}>
      {busy && <Loader2 className="w-4 h-4 animate-spin" />} {label}
    </button>
  );

  const renderBlock = (b: Block) => {
    switch (b.type) {
      case "heading":
        return <h1 key={b.id} className="text-[24px] sm:text-[28px] font-extrabold text-gray-900 tracking-[-0.02em] leading-tight">{b.text}</h1>;
      case "text":
        return <p key={b.id} className="text-[15px] text-gray-600 leading-relaxed">{b.text}</p>;
      case "image":
        // eslint-disable-next-line @next/next/no-img-element
        return b.imageUrl ? <img key={b.id} src={b.imageUrl} alt="" className="w-full rounded-xl" /> : null;
      case "zipCheck":
        return (
          <div key={b.id} className="space-y-2">
            <input inputMode="numeric" placeholder="ZIP code" defaultValue={answers.zipCode || ""}
              onChange={(e) => setAnswer("zipCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
              onKeyDown={(e) => { if (e.key === "Enter") checkZip(); }}
              className="w-full px-4 py-3.5 text-[16px] text-center tracking-widest border-2 border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
            {zipError && <p className="text-[13px] text-rose-600 text-center">{zipError}</p>}
            {btn(b.label || "Check my area", checkZip, false, zipLoading)}
          </div>
        );
      case "choice":
        return (
          <div key={b.id} className="grid gap-2.5">
            {(b.options || []).map((o) => {
              const active = b.field && answers[b.field] === o.value;
              return (
                <button key={o.value} onClick={() => b.field && selectChoice(b.field, o.value)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border-2 transition-colors flex items-center justify-between"
                  style={active ? { borderColor: primary, background: `${primary}0F` } : { borderColor: "#E5E7EB" }}>
                  <span>
                    <span className="block text-[15px] font-semibold text-gray-900">{o.label}</span>
                    {o.sublabel && <span className="block text-[13px] text-gray-500">{o.sublabel}</span>}
                  </span>
                  {active && <Check className="w-5 h-5" style={{ color: primary }} />}
                </button>
              );
            })}
          </div>
        );
      case "priceEstimate":
        return (
          <div key={b.id} className="rounded-2xl border-2 p-5 text-center" style={{ borderColor: `${primary}33`, background: `${primary}08` }}>
            {priceLoading ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: primary }} />
            ) : price?.priceNotConfigured || !price || price.perVisit == null ? (
              <p className="text-[15px] font-semibold text-gray-700">We&apos;ll build you a custom quote — enter your details and we&apos;ll reach out.</p>
            ) : (
              <>
                <p className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">Your estimate</p>
                <p className="text-[34px] font-extrabold text-gray-900 mt-1">
                  {money(price.perVisit)}<span className="text-[15px] font-semibold text-gray-500">{price.oneTime ? " one-time" : " / visit"}</span>
                </p>
                {!price.oneTime && price.monthly ? <p className="text-[14px] text-gray-600 mt-1">≈ {money(price.monthly)}/month</p> : null}
                {price.initialFee ? <p className="text-[13px] text-gray-500 mt-1">+ {money(price.initialFee)} one-time initial cleaning</p> : null}
              </>
            )}
          </div>
        );
      case "contactForm":
        return (
          <div key={b.id} className="space-y-2.5">
            {(b.fields || ["firstName", "phone", "email"]).map((f) => (
              <input key={f}
                type={f === "email" ? "email" : f === "phone" ? "tel" : "text"}
                inputMode={f === "phone" ? "tel" : undefined}
                placeholder={{ firstName: "First name", lastName: "Last name", email: "Email", phone: "Phone", address: "Street address" }[f]}
                value={answers[f] || ""} onChange={(e) => setAnswer(f, e.target.value)}
                className="w-full px-4 py-3.5 text-[16px] border-2 border-gray-200 rounded-xl focus:outline-none focus:border-gray-400" />
            ))}
            {formError && <p className="text-[13px] text-rose-600">{formError}</p>}
          </div>
        );
      case "cta": {
        const label = b.label || "Continue";
        if (b.ctaKind === "submit") return <div key={b.id}>{btn(label, submitFunnel, false, submitting)}</div>;
        if (b.ctaKind === "booking" || b.ctaKind === "link") {
          let href = b.ctaKind === "booking" ? bookingUrl : (b.href || "#");
          // Prefill the ZIP into the Sweep&Go onboarding (it accepts ?zip_code=).
          if (b.ctaKind === "booking" && answers.zipCode) {
            try { const u = new URL(bookingUrl); u.searchParams.set("zip_code", answers.zipCode); href = u.toString(); } catch { /* keep base */ }
          }
          return (
            <a key={b.id} href={href} target="_blank" rel="noopener noreferrer" onClick={() => logEvent("handoff", cur.id, { href })}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[15px] font-bold text-white transition-transform active:scale-[.99]"
              style={{ background: primary }}>{label}</a>
          );
        }
        return <div key={b.id}>{btn(label, () => advance())}</div>;
      }
      default: return null;
    }
  };

  if (!cur) return null;
  const progress = steps.length > 1 ? Math.round(((idx(cur.id) + 1) / steps.length) * 100) : 100;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg }}>
      <div className="flex-1 flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Progress */}
          <div className="h-1.5 bg-gray-100"><div className="h-full transition-all" style={{ width: `${progress}%`, background: primary }} /></div>
          <div className="p-5 sm:p-7">
            {history.length > 0 && (
              <button onClick={goBack} className="inline-flex items-center gap-1 text-[13px] text-gray-400 hover:text-gray-600 mb-3">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {data.theme?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.theme.logoUrl} alt="" className="h-8 mb-4" />
            )}
            <div className="space-y-4">{cur.blocks.map(renderBlock)}</div>
          </div>
        </div>
      </div>
      <p className="text-center text-[11px] text-white/50 pb-4 flex items-center justify-center gap-1">
        <MapPin className="w-3 h-3" /> DooGoodScoopers · Inland Empire
      </p>
    </div>
  );
}
