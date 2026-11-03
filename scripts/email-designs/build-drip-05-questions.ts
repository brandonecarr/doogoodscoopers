/**
 * Rebuilds Quote Recovery drip email 05, "The questions everyone asks"
 * (~/Downloads/email-drip-05-handoff.md), block by block as a designer v2 design.
 * Handoff designs are never imported from HTML.
 *
 *   node --env-file=.env --import=tsx scripts/email-designs/build-drip-05-questions.ts
 *       writes public/dev-samples/drip-05-questions.{json,html}
 *   ... --personalize <quoteLeadId> <outFile>
 *       also writes the email personalized for that lead (for a test send)
 *   ... --apply
 *       creates/updates the EmailTemplate AND the step in the "Quote recovery" drip:
 *       inserted after "Why neighbors stick with us" (step 4), before "Last reminder",
 *       which keeps its place as the final email. Re-running updates the step in place.
 *
 * Tokens: {{firstName}} {{initials}} {{frequency}} {{dogs}} {{monthlyRate}}
 *         {{resumeLink}} {{resumeCode}} {{unsubscribeUrl}}
 */
import fs from "fs";
import path from "path";
import { uid, spacing, type Design, type Section, type Column, type Block, type TextStyle, type Border } from "../../src/lib/email-designer/model";
import { renderDesign } from "../../src/lib/email-designer/render";

const LOGO = "https://oxorxznxhwdortpblfke.supabase.co/storage/v1/object/public/email-assets/1785365602957-img_3787.png";
/** Brand dog face, 108px square (3x of the 36px avatar), served from the CRM app. */
const DOG_AVATAR = "https://doogoodscoopers.vercel.app/email/dog-avatar.png";
const ARIAL = "Arial, Helvetica, sans-serif";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const INK = "#0B1B2B", BODY = "#3D5265", MUTED = "#8497A8", LIGHT = "#B9C6D0", LIGHTER = "#D5DEE5", BLUE = "#008EFF", MINT = "#9CD5CF", PAGE = "#F6FAFB", CARD_BORDER = "#E1E9EC";
const OUR_BUBBLE = "#F2F4F6", LEAD_BUBBLE = "#D9ECFF";
const WHITE = "#FFFFFF";

const CAMPAIGN_ID = "cmuxbwyx9000004kwpkbdvb6q"; // "Quote recovery" drip
const INSERT_AFTER_SUBJECT = /why neighbors/i;    // step 4
const LAST_REMINDER_SUBJECT = /last reminder/i;    // currently step 5, becomes step 6
const SUBJECT = "Still thinking it over?";
const TEMPLATE_NAME = "The questions everyone asks · Drip email 05";
const NEW_STEP_DELAY_MINUTES = 2 * 24 * 60;        // two days after "Why neighbors" (day 11)
const LAST_REMINDER_DELAY_MINUTES = 2 * 24 * 60;   // was four days; two keeps "Last reminder" on day 13

const border = (sides?: Border["sides"]): Border => ({ size: 1, color: CARD_BORDER, style: "solid", ...(sides ? { sides } : {}) });
const cardSides = { background: WHITE, border: border(["left", "right"]) };

const base = (name?: string) => ({ id: uid(), name, padding: spacing(0), margin: spacing(0), background: null as string | null, radius: 0, border: null as Border | null, visibility: "all" as const, condition: null });
const text = (name: string, html: string, style: TextStyle, align: "left" | "center" | "right" = "left", padding = spacing(0)): Block => ({ ...base(name), type: "text", html, align, style, padding });
const title = (name: string, html: string, style: TextStyle, align: "left" | "center" | "right" = "left", padding = spacing(0)): Block => ({ ...base(name), type: "title", html, level: 1, align, style, padding });
const column = (blocks: Block[], width = 100, extra: Partial<Column> = {}): Column => ({ ...base(), width, vAlign: "top", blocks, ...extra });
const section = (name: string, columns: Column[], extra: Partial<Section> = {}): Section => ({ ...base(name), columns, vAlign: "top", columnGap: 0, fullWidthBg: false, stackOnMobile: true, ...extra });
const eyebrow = (color: string, size = 12, tracking = 2.5): TextStyle => ({ font: ARIAL, size, color, bold: true, uppercase: true, lineHeight: 16 / size, letterSpacing: tracking });

// ---------------------------------------------------------------------------
// Chat thread. The designer has no bubble/avatar primitive, so the thread is one
// custom-HTML block built the way the handoff builds it: each bubble a two-cell
// table (avatar + bubble), avatars bottom-aligned with a 10px gap.
// ---------------------------------------------------------------------------
const bubbleText = `font-family:${ARIAL};font-size:15px;line-height:23px;mso-line-height-rule:exactly;color:${INK};`;
const dogAvatar = `<td width="36" valign="bottom" style="padding-right:10px;"><img src="${DOG_AVATAR}" width="36" height="36" alt="DooGoodScoopers" style="display:block;width:36px;height:36px;border-radius:18px;border:0;"></td>`;
const leadAvatar = `<td width="36" valign="bottom" style="padding-left:10px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="36" height="36" align="center" valign="middle" bgcolor="${BLUE}" style="background-color:${BLUE};border-radius:18px;font-family:${ARIAL};font-size:13px;font-weight:bold;color:${WHITE};line-height:36px;mso-line-height-rule:exactly;">{{initials}}</td></tr></table></td>`;
const gap = `<tr><td height="10" style="font-size:0;line-height:0;">&nbsp;</td></tr>`;

const ours = (inner: string, maxWidth: number, pad = "14px 18px") =>
  `<tr><td align="left"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${dogAvatar}<td>` +
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:${maxWidth}px;"><tr><td bgcolor="${OUR_BUBBLE}" style="background-color:${OUR_BUBBLE};border-radius:18px 18px 18px 6px;padding:${pad};${bubbleText}">${inner}</td></tr></table>` +
  `</td></tr></table></td></tr>`;
const theirs = (inner: string, maxWidth = 360) =>
  `<tr><td align="right"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td>` +
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:${maxWidth}px;"><tr><td bgcolor="${LEAD_BUBBLE}" style="background-color:${LEAD_BUBBLE};border-radius:18px 18px 6px 18px;padding:14px 18px;${bubbleText}">${inner}</td></tr></table>` +
  `</td>${leadAvatar}</tr></table></td></tr>`;

const bullet = (html: string) => `<tr><td valign="top" width="18" style="font-size:15px;line-height:23px;color:${BLUE};">&bull;</td><td style="${bubbleText}">${html}</td></tr>`;
const answers =
  `Fair questions. Short answers:` +
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;">` +
  bullet(`<b>No contracts, ever.</b> Pause, change frequency or cancel by text.`) +
  bullet(`<b>Your rate is set.</b> The only thing that varies is the initial cleaning fee, based on the yard on day one.`) +
  bullet(`<b>You don't need to be home.</b> Gate access is all we need. Photo and text when we're done.`) +
  bullet(`<b>Waste is bagged</b> and placed in your black bin, per California ordinance.`) +
  `</table>` +
  `Your quote is saved. Finishing takes about a minute.`;

const dot = (color: string) => `<td width="9" height="9" bgcolor="${color}" style="border-radius:5px;font-size:0;line-height:0;">&nbsp;</td>`;
const dotGap = `<td width="6" style="font-size:0;line-height:0;">&nbsp;</td>`;
// Mid-tone dots: mail clients that darken the bubble for dark mode (Gmail, Outlook) invert
// light greys into near-black, so the handoff's #8497A8/#B9C6D0/#D5DEE5 vanished there.
// These stay visible on both the light bubble and an inverted dark one (owner, 2026-11-02).
const DOT_1 = "#4E6275", DOT_2 = "#6E8294", DOT_3 = "#8EA0B0";
const typing = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${dot(DOT_1)}${dotGap}${dot(DOT_2)}${dotGap}${dot(DOT_3)}</tr></table>`;

const chatHtml =
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
  ours(`Hey, you ran a quote with us last week but didn't finish. Anything we can clear up?`, 360) + gap +
  theirs(`Honestly, just wondering what happens after I sign up. And whether I have to commit.`) + gap +
  ours(answers, 420, "16px 20px") + gap +
  theirs(`Okay, send me the link.`) + gap +
  ours(typing, 360) +
  `</table>`;

// ---------------------------------------------------------------------------
const stripHead: TextStyle = { font: ARIAL, size: 11, color: LIGHT, bold: true, uppercase: true, lineHeight: 14 / 11, letterSpacing: 1.5 };
const stripValue: TextStyle = { font: ARIAL, size: 18, color: WHITE, bold: true, lineHeight: 24 / 18 };
const stripCell = (head: string, valueHtml: string, width: number, color = WHITE): Column =>
  column([text(`${head} head`, head, stripHead), text(`${head} value`, valueHtml, { ...stripValue, color }, "left", spacing(4, 0, 0, 0))], width);

export const design: Design = {
  version: 2,
  styles: {
    bodyWidth: 600, pageBg: PAGE, bodyBg: PAGE, bodyPadding: spacing(28, 12, 40, 12), bodyRadius: 0, viewInBrowser: false,
    preheader: "Your quote is still saved, {{firstName}}. Here is what you asked us about.",
    text: {
      paragraph: { font: ARIAL, size: 16, color: BODY, lineHeight: 1.5625, bold: false, letterSpacing: 0 },
      title1: { font: GEORGIA, size: 38, color: INK, lineHeight: 44 / 38, bold: true, letterSpacing: -0.5 },
      title2: { font: GEORGIA, size: 28, color: INK, lineHeight: 1.25, bold: true, letterSpacing: -0.3 },
      title3: { font: ARIAL, size: 21, color: INK, lineHeight: 1.333, bold: true, letterSpacing: 0 },
    },
    link: { color: BLUE, bold: true, italic: false, underline: false },
    button: { font: ARIAL, size: 17, color: WHITE, bg: BLUE, radius: 14, bold: true, width: null, inner: spacing(18, 24), borderSize: 0, borderColor: BLUE },
  },
  sections: [
    // Brand bar: the real logo, phone on the right for desktop.
    section("Brand bar", [
      column([{ ...base("Logo"), type: "logo", src: LOGO, alt: "DooGoodScoopers", href: "https://doogoodscoopers.com", width: 280, align: "left" }], 60, { vAlign: "middle" }),
      column([text("Phone", `<a href="tel:9093663744" style="color:${BLUE};font-weight:bold;text-decoration:none">(909) 366-3744</a>`, { font: ARIAL, size: 13, color: BLUE, bold: true, lineHeight: 2 }, "right")], 40, { vAlign: "middle", visibility: "desktop", name: "Phone (desktop only)" }),
    ], { vAlign: "middle", stackOnMobile: false, padding: spacing(0, 8, 22, 8) }),

    // Main card, top: eyebrow, headline with the highlighted word, intro.
    section("Main card · headline", [column([
      text("Eyebrow", "Your quote is still saved", eyebrow(BLUE)),
      title("Headline", `The <span style="background-color:${BLUE};color:${WHITE};padding:0 8px;">questions</span> everyone asks before they sign up`, {}, "left", spacing(14, 0, 0, 0)),
      text("Intro", "{{firstName}}, you ran a quote and stopped. That usually means a question. These are the ones we hear most, so here they are, answered.", { font: ARIAL, size: 16, color: BODY, lineHeight: 25 / 16 }, "left", spacing(16, 0, 0, 0)),
    ])], { background: WHITE, border: border(["top", "left", "right"]), radius: 22, radiusCorners: "top", padding: spacing(40, 40, 0, 40) }),

    // Main card, middle: the chat thread.
    section("Main card · chat", [column([
      { ...base("Chat thread"), type: "html", html: chatHtml },
    ])], { ...cardSides, padding: spacing(28, 40, 0, 40) }),

    // Saved quote strip (navy), inset in the white card: label on top, three values below.
    section("Saved quote · label", [column([
      text("Strip label", "Still saved for you", eyebrow(MINT, 11, 2)),
    ])], { background: INK, radius: 14, radiusCorners: "top", margin: spacing(28, 40, 0, 40), padding: spacing(20, 24, 0, 24), outer: cardSides }),
    section("Saved quote · values", [
      stripCell("Plan", "{{frequency}}", 33),
      stripCell("Dogs", "{{dogs}}", 33),
      stripCell("Your rate", `{{monthlyRate}} <span style="font-size:13px;font-weight:normal;color:${LIGHT}">/ month</span>`, 34, MINT),
    ], { background: INK, radius: 14, radiusCorners: "bottom", margin: spacing(0, 40, 0, 40), padding: spacing(10, 24, 18, 24), outer: cardSides, stackGap: 10 }),

    // Main card, bottom: full-width CTA and the meta line.
    section("Main card · CTA", [column([
      { ...base("Finish signup button"), type: "button", label: "Finish my signup →", href: "{{resumeLink}}", align: "center", style: {}, width: 100, widthUnit: "%", inner: spacing(18, 24), buttonBorder: null, padding: spacing(0) },
      text("Meta line", `Resume code <span style="font-family:'Courier New',Courier,monospace;color:${INK};font-weight:bold">{{resumeCode}}</span> &nbsp;&middot;&nbsp; About a minute to finish &nbsp;&middot;&nbsp; No contracts, ever.`, { font: ARIAL, size: 13, color: MUTED, lineHeight: 20 / 13 }, "center", spacing(14, 0, 0, 0)),
    ])], { background: WHITE, border: border(["left", "right", "bottom"]), radius: 22, radiusCorners: "bottom", padding: spacing(22, 40, 36, 40) }),

    // Sign-off.
    section("Sign-off", [column([
      text("Sign-off", `Still have a question, {{firstName}}? Call or text <a href="tel:9093663744" style="color:${BLUE};font-weight:bold;text-decoration:none">(909) 366-3744</a> any time. Brandon or Valerie will answer.`, { font: ARIAL, size: 15, color: BODY, lineHeight: 23 / 15 }, "center"),
    ])], { padding: spacing(30, 24, 10, 24) }),

    // Footer.
    section("Footer", [column([
      text("Footer", `DooGoodScoopers &middot; 11799 Sebastian Way, Suite 103, Rancho Cucamonga, CA 91730<br>You're receiving this because you requested a quote at doogoodscoopers.com.<br><a href="{{unsubscribeUrl}}" style="color:${MUTED};font-weight:normal;text-decoration:underline">Unsubscribe</a> &nbsp;&middot;&nbsp; <a href="https://doogoodscoopers.com/privacy-policy/" style="color:${MUTED};font-weight:normal;text-decoration:underline">Privacy Policy</a>`, { font: ARIAL, size: 12, color: MUTED, lineHeight: 1.5 }, "center"),
    ])], { border: border(["top"]), padding: spacing(22, 24, 0, 24) }),
  ],
};

async function main() {
  const html = renderDesign(design);
  const out = path.join(process.cwd(), "public/dev-samples");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "drip-05-questions.json"), JSON.stringify(design, null, 2));
  fs.writeFileSync(path.join(out, "drip-05-questions.html"), html);
  console.log(`rendered ${html.length} chars → public/dev-samples/drip-05-questions.{json,html}`);

  const argv = process.argv;
  const pIdx = argv.indexOf("--personalize");
  if (pIdx > 0) {
    const [leadId, outFile] = [argv[pIdx + 1], argv[pIdx + 2]];
    const { getLeadPersonalization } = await import("../../src/lib/personalization");
    const { personalizeHtml } = await import("../../src/lib/email-send");
    const vars = await getLeadPersonalization("QUOTE_FORM", leadId, { channel: "email" });
    fs.writeFileSync(outFile, personalizeHtml(html, { ...vars, unsubscribeUrl: "https://doogoodscoopers.com/" }, "https://doogoodscoopers.com/"));
    console.log(`personalized for ${vars.name || leadId} (${vars.initials}, ${vars.frequency}, ${vars.dogs}, ${vars.monthlyRate}) → ${outFile}`);
  }

  if (argv.includes("--apply")) {
    const { default: prisma } = await import("../../src/lib/prisma");
    const { textFromHtml } = await import("../../src/lib/campaign-email");
    const { rescheduleActiveRecipients } = await import("../../src/lib/drip-schedule");

    // 1. The reusable template.
    const existing = await prisma.emailTemplate.findFirst({ where: { name: TEMPLATE_NAME }, select: { id: true } });
    const data = { name: TEMPLATE_NAME, subject: SUBJECT, html, designJson: design as object, category: "Drip", adminEmail: "brandonecarr@gmail.com" };
    const tpl = existing ? await prisma.emailTemplate.update({ where: { id: existing.id }, data }) : await prisma.emailTemplate.create({ data });
    console.log(`${existing ? "updated" : "created"} EmailTemplate ${tpl.id}`);

    // 2. The drip step (steps hold their own copy of the design).
    const steps = await prisma.campaignStep.findMany({ where: { campaignId: CAMPAIGN_ID }, orderBy: { stepOrder: "asc" } });
    const body = textFromHtml(html, 600);
    const stepData = { body, channel: "email", subject: SUBJECT, html, designJson: design as object };
    const mine = steps.find((s) => s.subject === SUBJECT);
    if (mine) {
      await prisma.campaignStep.update({ where: { id: mine.id }, data: stepData });
      console.log(`updated CampaignStep ${mine.id} in place (step ${mine.stepOrder})`);
    } else {
      const after = steps.find((s) => INSERT_AFTER_SUBJECT.test(s.subject || ""));
      const last = steps.find((s) => LAST_REMINDER_SUBJECT.test(s.subject || ""));
      if (!after || !last) throw new Error("Quote recovery drip no longer has the expected steps; not inserting");
      const at = after.stepOrder + 1;
      await prisma.$transaction([
        prisma.campaignStep.updateMany({ where: { campaignId: CAMPAIGN_ID, stepOrder: { gte: at } }, data: { stepOrder: { increment: 1 } } }),
        prisma.campaignStep.create({ data: { campaignId: CAMPAIGN_ID, stepOrder: at, delayMinutes: NEW_STEP_DELAY_MINUTES, ...stepData } }),
        prisma.campaignStep.update({ where: { id: last.id }, data: { delayMinutes: LAST_REMINDER_DELAY_MINUTES } }),
        // Leads already past the insertion point keep their place in the sequence (currentStep indexes the ordered steps).
        prisma.campaignRecipient.updateMany({ where: { campaignId: CAMPAIGN_ID, status: "ACTIVE", currentStep: { gt: at } }, data: { currentStep: { increment: 1 } } }),
      ]);
      const moved = await rescheduleActiveRecipients(CAMPAIGN_ID);
      console.log(`inserted step ${at} (delay ${NEW_STEP_DELAY_MINUTES} min); "${last.subject}" now step ${last.stepOrder + 1} with delay ${LAST_REMINDER_DELAY_MINUTES} min; rescheduled ${moved} recipients`);
    }
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
