"use client";

import { Link2, Ticket } from "lucide-react";

// One-click personalization tokens for a message body. The parent decides how
// the snippet lands in its textarea (appended at the end).
const TOKENS: Array<{ label: string; snippet: string; title?: string }> = [
  { label: "First name", snippet: "{{firstName}}" },
  { label: "ZIP", snippet: "{{zipCode}}" },
  { label: "Dogs", snippet: "{{dogs}}", title: 'e.g. "2 dogs"' },
];

export function TokenChips({ onInsert, email = false, className = "" }: { onInsert: (snippet: string) => void; email?: boolean; className?: string }) {
  const chip = "px-2 py-0.5 text-[11px] font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-navy-900";
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="text-[11px] text-gray-400">Insert:</span>
      {TOKENS.map((t) => (
        <button key={t.snippet} type="button" title={t.title} onClick={() => onInsert(t.snippet)} className={chip}>
          {t.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onInsert(email ? "\n\n[Finish signing up]({{resumeLink}})\n" : "{{resumeLink}}")}
        title="The lead's personal resume link on doogoodscoopers.com: reopens their quote with everything they entered and continues the same Sweep&Go signup."
        className={`${chip} inline-flex items-center gap-1 border-teal-200 text-teal-700`}
      >
        <Link2 className="w-3 h-3" />
        {email ? "Resume-signup button" : "Resume-signup link"}
      </button>
      <button type="button" onClick={() => onInsert("{{coupon}}")} title="The recovery coupon code from Quote recovery settings." className={`${chip} inline-flex items-center gap-1`}>
        <Ticket className="w-3 h-3" />
        Coupon
      </button>
    </div>
  );
}

/** Append a snippet to a body, keeping a space or line break before it. */
export function appendSnippet(body: string, snippet: string): string {
  if (!body) return snippet.replace(/^\n+/, "");
  if (snippet.startsWith("\n") || /\s$/.test(body)) return body + snippet;
  return `${body} ${snippet}`;
}
