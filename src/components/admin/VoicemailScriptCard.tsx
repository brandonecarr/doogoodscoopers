"use client";

import { useEffect, useState } from "react";
import { Voicemail, Copy, Check } from "lucide-react";

// Read-aloud voicemail for calling a new quote lead, filled in with their details.
// Short (~20s), personal, and gives a reason to call back ("your price is ready")
// plus an easy out ("or just text me").

type Tab = "first" | "second" | "text";
const NAME_KEY = "dgs.voicemail.callerName";

export function VoicemailScriptCard({ firstName, city, dogs, routeDay, phone }: {
  firstName: string | null;
  city: string | null;
  dogs: string | null;
  routeDay: string | null;
  phone: string;
}) {
  const [tab, setTab] = useState<Tab>("first");
  const [caller, setCaller] = useState("Brandon");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { const saved = localStorage.getItem(NAME_KEY); if (saved) setCaller(saved); } catch {}
  }, []);
  const saveCaller = (v: string) => {
    setCaller(v);
    try { localStorage.setItem(NAME_KEY, v); } catch {}
  };

  // Quote leads often hold the full name ("Brett Glazier") in firstName; say just "Brett".
  const first = (firstName || "").trim().split(/\s+/)[0] || "";
  const name = first && first !== "Unknown"
    ? (first === first.toUpperCase() || first === first.toLowerCase() ? first[0].toUpperCase() + first.slice(1).toLowerCase() : first)
    : "there";
  const me = caller.trim() || "Brandon";
  const n = dogs ? parseInt(dogs, 10) : NaN;
  const forWhat = Number.isFinite(n) && n > 0 ? `your ${n} ${n === 1 ? "dog" : "dogs"}` : "your yard";
  const where = city ? ` in ${city}` : "";
  const opening = routeDay
    ? `I'm holding an opening on our ${routeDay} route in your neighborhood for you`
    : `I have openings this week${where}`;
  const holdLine = routeDay
    ? `I don't want you to lose the ${routeDay} opening${where}, so I'll hold it until tomorrow.`
    : `I'd love to get you on the schedule this week, so I'll keep a spot open until tomorrow.`;

  const scripts: Record<Tab, string> = {
    first:
      `Hi ${name}, this is ${me} with DooGoodScoopers. You just requested a quote on our site for ${forWhat}${where}. ` +
      `I've got your price ready, and ${opening}. ` +
      `Give me a call back at ${phone}, that's ${phone}, or just text me at this number. Thanks, ${name}, talk soon!`,
    second:
      `Hi ${name}, ${me} from DooGoodScoopers again, following up on your quote. ${holdLine} ` +
      `If now's not a good time, no problem, just text me at ${phone}. Have a great day!`,
    text:
      `Hi ${name}, it's ${me} from DooGoodScoopers. Just left you a voicemail about your quote. ` +
      `Your price is ready. Want me to text it over, or is there a good time for a quick call?`,
  };

  const copy = () => {
    navigator.clipboard?.writeText(scripts[tab]).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }).catch(() => {});
  };

  const tabs: [Tab, string][] = [["first", "1st call"], ["second", "2nd call"], ["text", "Text after"]];

  return (
    <div className="dgs-card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold text-navy-900 flex items-center gap-2">
          <Voicemail className="w-5 h-5 text-teal-600" /> Voicemail script
        </h2>
        <button onClick={copy} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200" title="Copy this script">
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-3">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors ${tab === key ? "bg-white text-navy-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {label}
          </button>
        ))}
      </div>

      <p className="text-[15px] leading-relaxed text-navy-900">{scripts[tab]}</p>

      <p className="text-xs text-gray-400 mt-3">
        {tab === "text"
          ? "Send right after the voicemail. Offering to text the price removes the reason people avoid calling back."
          : "Smile while you talk, keep it under 30 seconds, and say the number slowly both times."}
        {tab !== "text" && !routeDay && " No regular route day near this ZIP yet, so the script offers openings this week instead."}
      </p>

      <label className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        Caller name
        <input value={caller} onChange={(e) => saveCaller(e.target.value)} className="flex-1 px-2 py-1 border border-gray-200 rounded-md text-xs text-navy-900 focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
      </label>
    </div>
  );
}
