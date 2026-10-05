// Starter sequences for the campaign builder (no database access). Loading one
// only fills in the builder; every message stays editable before and after launch.

export interface TemplateStep {
  channel: "sms" | "email";
  subject: string;
  body: string;
  delayDays: number; // after the previous message (first one: after enrollment)
}

export const WINBACK_CODE = "WELCOMEBACK25";
export const WINBACK_FROM = "Brandon at DooGoodScoopers";
/** Stands in for the signup link until one is entered; a campaign can't go live with it. */
export const LINK_PLACEHOLDER = "https://YOUR-SIGNUP-LINK";

const fmtDeadline = (d: string, style: "long" | "short" | "weekday") => {
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day, 12));
  if (style === "short") return `${m}/${day}`;
  if (style === "weekday") return date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
};

const SIGN_OFF = "Thanks,\nBrandon\nDooGoodScoopers · (909) 366-3744";

/** 25% off the first month: 3 emails (days 0, 7, 14) and 2 texts (days 2, 12). */
export function winbackTemplate(deadline: string, signupLink: string): TemplateStep[] {
  const link = signupLink.trim() || LINK_PLACEHOLDER;
  const long = fmtDeadline(deadline, "long");
  return [
    {
      channel: "email", delayDays: 0,
      subject: "{{firstName}}, we'd love to have you back",
      body: [
        "Hi {{firstName}},",
        "It's Brandon from DooGoodScoopers. It's been a while since we've taken care of your yard, and I wanted to reach out personally.",
        `If you'd like a clean, poop-free yard again without lifting a finger, I'd love to have you back. As a thank-you for giving us another shot, **your first month is 25% off**. Just use code **${WINBACK_CODE}** when you sign up.`,
        `The offer is good through **${long}**.`,
        "If something didn't go right last time, I'd honestly like to hear about it. Just hit reply. And if you've moved or no longer need us, reply and I'll take you off the list.",
        `[Get 25% off my first month](${link})`,
        SIGN_OFF,
      ].join("\n\n"),
    },
    {
      channel: "sms", delayDays: 2, subject: "",
      body: `Hi {{firstName}}, it's Brandon from DooGoodScoopers! We'd love to have you back, so your first month is 25% off with code ${WINBACK_CODE} through ${fmtDeadline(deadline, "short")}. Sign up: ${link} Reply STOP to opt out.`,
    },
    {
      channel: "email", delayDays: 5,
      subject: "Still thinking about it?",
      body: [
        "Hi {{firstName}},",
        `Just a quick reminder that your 25% off first month (code **${WINBACK_CODE}**) is good through ${long}.`,
        "Weekly or every-other-week service, the same reliable cleanups, and you'll get a photo after every visit so you know it's done.",
        `[Claim my 25% off](${link})`,
        SIGN_OFF,
      ].join("\n\n"),
    },
    {
      channel: "sms", delayDays: 5, subject: "",
      body: `Last call, {{firstName}}! Your 25% off first month with DooGoodScoopers ends ${fmtDeadline(deadline, "weekday")}. Code ${WINBACK_CODE}: ${link} Reply STOP to opt out.`,
    },
    {
      channel: "email", delayDays: 2,
      subject: "Last day for 25% off",
      body: [
        "Hi {{firstName}},",
        `Today's the last day to get 25% off your first month with code **${WINBACK_CODE}**. After today it goes back to regular pricing.`,
        "Hope to see you back!",
        `[Use my 25% off today](${link})`,
        SIGN_OFF,
      ].join("\n\n"),
    },
  ];
}
