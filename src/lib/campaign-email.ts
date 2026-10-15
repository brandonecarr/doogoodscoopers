// Turns the plain text of an email step into the HTML that is sent (no database
// access, so the campaign builder can preview it live).
//   blank line            → new paragraph
//   **bold**              → bold
//   [label](https://...)  → link; on a line of its own it becomes a button
//   bare https://... URLs → links

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const BUTTON_LINE = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;
const INLINE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+[^\s<.,!?)])|\*\*([^*]+)\*\*/g;

function inline(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    out += esc(text.slice(last, m.index));
    if (m[1] && m[2]) out += `<a href="${esc(m[2])}" style="color:#0d9488;">${esc(m[1])}</a>`;
    else if (m[3]) out += `<a href="${esc(m[3])}" style="color:#0d9488;">${esc(m[3])}</a>`;
    else out += `<strong>${esc(m[4])}</strong>`;
    last = m.index! + m[0].length;
  }
  return out + esc(text.slice(last));
}

export function emailTextToHtml(text: string): string {
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  const html = blocks.map((block) => {
    const b = block.trim();
    const btn = b.match(BUTTON_LINE);
    if (btn) {
      return `<p style="margin:24px 0;"><a href="${esc(btn[2])}" style="background:#0d9488;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">${esc(btn[1])}</a></p>`;
    }
    return `<p style="margin:0 0 16px;">${b.split("\n").map(inline).join("<br/>")}</p>`;
  });
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;padding:28px 28px 12px;">\n${html.join("\n")}\n</div>`;
}

/**
 * Plain-text summary of a designed (HTML) email, for the campaign list, the lead
 * timeline and the SMS-style preview: tags stripped, entities decoded, whitespace
 * collapsed, capped.
 */
export function textFromHtml(html: string, max = 1000): string {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/**
 * The builder URL-encodes braces when a token is used as a link ("%7B%7BresumeLink%7D%7D");
 * put them back so renderTemplate can fill the token.
 */
export function decodeTemplateTokens(html: string): string {
  return html.replace(/%7B%7B\s*(\w+)\s*%7D%7D/gi, "{{$1}}");
}
