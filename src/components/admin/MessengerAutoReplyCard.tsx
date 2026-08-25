"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Loader2, Check } from "lucide-react";

const PLACEHOLDER =
  "Hey! Thanks for reaching out to DooGoodScoopers 🐾 Happy to help — what's your ZIP code and how many dogs do you have? I'll get you a quick quote.";

// Controls the one-time Facebook Messenger auto-greeting (on/off + the text).
export function MessengerAutoReplyCard() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [greetEveryone, setGreetEveryone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/messenger-settings")
      .then((r) => r.json())
      .then((d) => { setEnabled(!!d.enabled); setMessage(d.message || ""); setGreetEveryone(!!d.greetEveryone); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (next: { enabled?: boolean; message?: string; greetEveryone?: boolean }) => {
    setSaving(true); setSaved(false);
    try {
      await fetch("/api/admin/messenger-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const toggle = () => { const v = !enabled; setEnabled(v); void save({ enabled: v }); };
  const toggleEveryone = () => { const v = !greetEveryone; setGreetEveryone(v); void save({ greetEveryone: v }); };

  return (
    <div className="dgs-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#0084FF]/10 flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-[#0084FF]" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-navy-900">Messenger auto-greeting</p>
            <p className="text-[12px] text-gray-500">One instant reply the first time someone messages your Facebook Page. Never repeats.</p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          disabled={loading || saving}
          className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50"
          style={{ background: enabled ? "#16A34A" : "#D1D5DB" }}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </button>
      </div>

      {enabled && (
        <div className="mt-3">
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Greeting message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => save({ message })}
            placeholder={PLACEHOLDER}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0084FF]/30 focus:border-transparent resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-gray-400">Leave blank to use the default. Saves when you click away.</p>
            {saving ? <span className="text-[11px] text-gray-400 inline-flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving</span>
              : saved ? <span className="text-[11px] text-green-600 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span> : null}
          </div>

          {/* Review/testing mode: greet everyone, not just matched ad/form leads. */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-navy-900">Greet everyone (App Review / testing)</p>
              <p className="text-[11px] text-gray-500">
                Normally the greeting only fires for real ad/form leads. Turn this ON to greet <b>anyone</b> who messages — needed so your App Review screencast and Meta&apos;s reviewer get a reply. <b>Turn it back OFF after approval.</b>
              </p>
            </div>
            <button
              role="switch"
              aria-checked={greetEveryone}
              onClick={toggleEveryone}
              disabled={loading || saving}
              className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50"
              style={{ background: greetEveryone ? "#D97706" : "#D1D5DB" }}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${greetEveryone ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
