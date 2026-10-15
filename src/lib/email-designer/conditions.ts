/**
 * Show-conditions in rendered email HTML.
 *
 * The renderer wraps a conditional section/column/block in comment markers:
 *   <!--dgs:if coupon present-->…<!--dgs:endif-->
 * The sender resolves them per recipient against the personalization values:
 * "present" keeps the content when the token has a non-empty value, "absent"
 * keeps it when the token is empty or unknown. Markers nest; inner ones are
 * resolved first. Unknown tokens count as empty.
 */

const MARKER = /<!--dgs:if\s+(\w+)\s+(present|absent)-->([\s\S]*?)<!--dgs:endif-->/g;

export function applyShowConditions(html: string, vars: Record<string, string | null | undefined>): string {
  let out = html;
  // Resolve innermost first: a non-greedy match that contains no nested opener.
  for (let i = 0; i < 20 && /<!--dgs:if/.test(out); i++) {
    const before = out;
    out = out.replace(/<!--dgs:if\s+(\w+)\s+(present|absent)-->((?:(?!<!--dgs:if)[\s\S])*?)<!--dgs:endif-->/g, (_, token: string, when: string, inner: string) => {
      const has = !!(vars[token] || "").toString().trim();
      return (when === "present") === has ? inner : "";
    });
    if (out === before) break;
  }
  return out.replace(MARKER, (_, token: string, when: string, inner: string) => ((when === "present") === !!(vars[token] || "").toString().trim() ? inner : ""));
}

/** Strip the markers but keep everything (for previews where every token is "present"). */
export const stripConditionMarkers = (html: string) => html.replace(/<!--dgs:if\s+\w+\s+(?:present|absent)-->|<!--dgs:endif-->/g, "");
