// Win-back message copy (no database access, so the admin page can preview it live).
// {{firstName}} is filled in at send time by the email and SMS engines.

export const WINBACK_CODE = "WELCOMEBACK25";
export const WINBACK_FROM = "Brandon at DooGoodScoopers";

export const fmtDeadline = (d: string, style: "long" | "short") => {
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day, 12));
  return style === "long"
    ? date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
    : `${m}/${day}`;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function emailHtml(paragraphs: string[], link: string, cta: string): string {
  const p = (t: string) => `<p style="margin:0 0 16px;">${t}</p>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;padding:28px 28px 12px;">
${paragraphs.map(p).join("\n")}
<p style="margin:24px 0;"><a href="${esc(link)}" style="background:#0d9488;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">${cta}</a></p>
<p style="margin:0 0 4px;">Thanks,</p>
<p style="margin:0;">Brandon<br/>DooGoodScoopers &middot; (909) 366-3744</p>
</div>`;
}

/** The five messages, filled with the deadline and signup link ({{firstName}} filled at send). */
export function winbackMessages(deadline: string, signupLink: string) {
  const long = fmtDeadline(deadline, "long");
  const short = fmtDeadline(deadline, "short");
  const code = `<strong>${WINBACK_CODE}</strong>`;
  return {
    emails: [
      {
        day: 0,
        subject: "{{firstName}}, we'd love to have you back",
        html: emailHtml([
          "Hi {{firstName}},",
          "It's Brandon from DooGoodScoopers. It's been a while since we've taken care of your yard, and I wanted to reach out personally.",
          `If you'd like a clean, poop-free yard again without lifting a finger, I'd love to have you back. As a thank-you for giving us another shot, <strong>your first month is 25% off</strong>. Just use code ${code} when you sign up.`,
          `The offer is good through <strong>${long}</strong>.`,
          "If something didn't go right last time, I'd honestly like to hear about it. Just hit reply. And if you've moved or no longer need us, reply and I'll take you off the list.",
        ], signupLink, "Get 25% off my first month"),
      },
      {
        day: 7,
        subject: "Still thinking about it?",
        html: emailHtml([
          "Hi {{firstName}},",
          `Just a quick reminder that your 25% off first month (code ${code}) is good through ${long}.`,
          "Weekly or every-other-week service, the same reliable cleanups, and you'll get a photo after every visit so you know it's done.",
        ], signupLink, "Claim my 25% off"),
      },
      {
        day: 14,
        subject: "Last day for 25% off",
        html: emailHtml([
          "Hi {{firstName}},",
          `Today's the last day to get 25% off your first month with code ${code}. After today it goes back to regular pricing.`,
          "Hope to see you back!",
        ], signupLink, "Use my 25% off today"),
      },
    ],
    texts: [
      { day: 2, body: `Hi {{firstName}}, it's Brandon from DooGoodScoopers! We'd love to have you back, so your first month is 25% off with code ${WINBACK_CODE} through ${short}. Sign up: ${signupLink} Reply STOP to opt out.` },
      { day: 12, body: `Last call, {{firstName}}! Your 25% off first month with DooGoodScoopers ends ${fmtDeadline(deadline, "long").split(",")[0]}. Code ${WINBACK_CODE}: ${signupLink} Reply STOP to opt out.` },
    ],
  };
}
