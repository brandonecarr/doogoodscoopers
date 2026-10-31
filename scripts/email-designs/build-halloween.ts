/**
 * Rebuilds the "Happy Halloween" handoff (~/Downloads/email-halloween-handoff.md)
 * block by block as a designer v2 design, the way the four Apple Valley drip
 * emails were built. Handoff designs are never imported from HTML.
 *
 *   node --env-file=.env --import=tsx scripts/email-designs/build-halloween.ts          # writes public/dev-samples/halloween.{json,html}
 *   node --env-file=.env --import=tsx scripts/email-designs/build-halloween.ts --apply  # also creates/updates the EmailTemplate
 */
import fs from "fs";
import path from "path";
import { uid, spacing, type Design, type Section, type Column, type Block, type TextStyle, type Border } from "../../src/lib/email-designer/model";
import { renderDesign } from "../../src/lib/email-designer/render";

const LOGO = "https://oxorxznxhwdortpblfke.supabase.co/storage/v1/object/public/email-assets/1785365602957-img_3787.png";
const ARIAL = "Arial, Helvetica, sans-serif";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const INK = "#0B1B2B", BODY = "#3D5265", MUTED = "#8497A8", BLUE = "#008EFF", MINT = "#9CD5CF", MINT_TINT = "#E7F1F3", PAGE = "#F6FAFB", CARD_BORDER = "#E1E9EC", NAVY_BODY = "#B9C6D0";
const border = (sides?: Border["sides"]): Border => ({ size: 1, color: CARD_BORDER, style: "solid", ...(sides ? { sides } : {}) });

const base = (name?: string) => ({ id: uid(), name, padding: spacing(0), margin: spacing(0), background: null as string | null, radius: 0, border: null as Border | null, visibility: "all" as const, condition: null });
const text = (name: string, html: string, style: TextStyle, align: "left" | "center" | "right" = "left", padding = spacing(0)): Block => ({ ...base(name), type: "text", html, align, style, padding });
const title = (name: string, html: string, style: TextStyle, align: "left" | "center" | "right" = "left", padding = spacing(0)): Block => ({ ...base(name), type: "title", html, level: 1, align, style, padding });
const column = (blocks: Block[], width = 100, extra: Partial<Column> = {}): Column => ({ ...base(), width, vAlign: "top", blocks, ...extra });
const section = (name: string, columns: Column[], extra: Partial<Section> = {}): Section => ({ ...base(name), columns, vAlign: "top", columnGap: 0, fullWidthBg: false, stackOnMobile: true, ...extra });

const eyebrow = (color: string, size = 12, tracking = 2.5): TextStyle => ({ font: ARIAL, size, color, bold: true, uppercase: true, lineHeight: 16 / size, letterSpacing: tracking });

const design: Design = {
  version: 2,
  styles: {
    bodyWidth: 600, pageBg: PAGE, bodyBg: PAGE, bodyPadding: spacing(28, 12), bodyRadius: 0, viewInBrowser: false,
    preheader: "The only thing lurking in your yard tonight should be trick-or-treaters. Happy Halloween, {{firstName}}.",
    text: {
      paragraph: { font: ARIAL, size: 16, color: BODY, lineHeight: 1.5625, bold: false, letterSpacing: 0 },
      title1: { font: GEORGIA, size: 40, color: INK, lineHeight: 1.15, bold: true, letterSpacing: -0.5 },
      title2: { font: GEORGIA, size: 28, color: INK, lineHeight: 1.25, bold: true, letterSpacing: -0.3 },
      title3: { font: ARIAL, size: 21, color: INK, lineHeight: 1.333, bold: true, letterSpacing: 0 },
    },
    link: { color: BLUE, bold: true, italic: false, underline: false },
    button: { font: ARIAL, size: 16, color: "#FFFFFF", bg: BLUE, radius: 14, bold: true, width: null, inner: spacing(16, 30), borderSize: 0, borderColor: BLUE },
  },
  sections: [
    // Brand bar: the real logo (280px, like the drip emails), phone on the right for desktop.
    section("Brand bar", [
      column([{ ...base("Logo"), type: "logo", src: LOGO, alt: "DooGoodScoopers", href: "https://doogoodscoopers.com", width: 280, align: "left" }], 60, { vAlign: "middle" }),
      column([text("Phone", `<a href="tel:9093663744" style="color:${BLUE};font-weight:bold;text-decoration:none">(909) 366-3744</a>`, { font: ARIAL, size: 13, color: BLUE, bold: true, lineHeight: 2 }, "right")], 40, { vAlign: "middle", visibility: "desktop", name: "Phone (desktop only)" }),
    ], { vAlign: "middle", stackOnMobile: false, padding: spacing(0, 8, 18, 8) }),

    // Hero card, top half: eyebrow, headline, subhead.
    section("Hero card", [column([
      text("Eyebrow", "October 31", eyebrow(BLUE), "center"),
      title("Headline", "Happy Halloween", {}, "center", spacing(12, 0, 0, 0)),
      text("Subhead", "From all of us at DooGoodScoopers to you, {{firstName}}, and the dogs.", { font: ARIAL, size: 17, color: BODY, lineHeight: 1.529 }, "center", spacing(14, 0, 0, 0)),
    ])], { background: "#FFFFFF", border: border(["top", "left", "right"]), radius: 22, radiusCorners: "top", padding: spacing(44, 40, 12, 40) }),

    // Hero card, bottom half: the tinted thank-you box.
    section("Hero message", [column([
      text("Message", `Tonight the gate opens a lot more than usual. Costumes, candy, strangers on the porch, a dog who has opinions about all of it. The one thing you shouldn't have to think about is what's in the grass.<br><br>Your yard is on our route this week, same as always. So let the kids run, let the dog bark at the skeletons, and enjoy the night.<br><br><span style="color:${INK};font-weight:bold">Thank you for trusting us with your yard. It means a lot to a local family business.</span>`, { font: ARIAL, size: 16, color: BODY, lineHeight: 1.5625 }),
    ], 100, { name: "Message box", background: PAGE, border: border(), radius: 16, padding: spacing(26, 28) })], { background: "#FFFFFF", border: border(["left", "right", "bottom"]), radius: 22, radiusCorners: "bottom", padding: spacing(26, 40, 40, 40) }),

    // Two quick notes, side by side; stack with a 12px gap on phones.
    section("Two notes", [
      column([
        text("Candy eyebrow", "Candy warning", eyebrow(MINT, 12, 2)),
        text("Candy title", "Chocolate, xylitol and raisins are toxic to dogs", { font: ARIAL, size: 17, color: "#FFFFFF", bold: true, lineHeight: 1.412 }, "left", spacing(8, 0, 0, 0)),
        text("Candy body", "Keep the bowl up high. If something gets eaten, call the ASPCA Poison Control line at (888) 426-4435.", { font: ARIAL, size: 14, color: NAVY_BODY, lineHeight: 1.571 }, "left", spacing(6, 0, 0, 0)),
      ], 50, { name: "Candy warning (navy)", background: INK, radius: 18, padding: spacing(24) }),
      column([
        text("Gate eyebrow", "Gate check", eyebrow(BLUE, 12, 2)),
        text("Gate title", "Lots of door traffic tonight", { font: ARIAL, size: 17, color: INK, bold: true, lineHeight: 1.412 }, "left", spacing(8, 0, 0, 0)),
        text("Gate body", "Side gates get left open on Halloween more than any other night. A quick latch check before dark saves a long night of searching.", { font: ARIAL, size: 14, color: BODY, lineHeight: 1.571 }, "left", spacing(6, 0, 0, 0)),
      ], 50, { name: "Gate check (mint)", background: MINT_TINT, radius: 18, padding: spacing(24) }),
    ], { columnGap: 16, stackGap: 12, margin: spacing(16, 0, 0, 0) }),

    // Referral card.
    section("Referral card", [column([
      text("Referral title", "Know a neighbor with a scary yard?", { font: ARIAL, size: 21, color: INK, bold: true, lineHeight: 1.333 }, "center"),
      text("Referral body", "Refer a friend and you both get $25 when they sign up.", { font: ARIAL, size: 15, color: BODY, lineHeight: 1.533 }, "center", spacing(8, 0, 0, 0)),
      { ...base("Share the Scoop button"), type: "button", label: "Share the Scoop →", href: "https://doogoodscoopers.com/sng/refer-a-friend/", align: "center", style: {}, width: null, widthUnit: "px", inner: spacing(16, 30), buttonBorder: null, padding: spacing(18, 0, 0, 0) },
    ])], { background: "#FFFFFF", border: border(), radius: 22, margin: spacing(16, 0, 0, 0), padding: spacing(30, 40, 34, 40) }),

    // Sign-off.
    section("Sign-off", [column([
      text("Sign-off", `Stay safe out there. Give the dog a treat from us.<br><span style="color:${INK};font-weight:bold">Brandon, Valerie and the DooGoodScoopers team</span>`, { font: ARIAL, size: 15, color: BODY, lineHeight: 1.533 }, "center"),
    ])], { padding: spacing(28, 24, 8, 24) }),

    // Footer.
    section("Footer", [column([
      text("Footer", `DooGoodScoopers &middot; 11799 Sebastian Way, Suite 103, Rancho Cucamonga, CA 91730<br>You're receiving this because you're a DooGoodScoopers customer.<br><a href="{{unsubscribeUrl}}" style="color:${MUTED};font-weight:normal;text-decoration:underline">Unsubscribe</a> &nbsp;&middot;&nbsp; <a href="https://doogoodscoopers.com/privacy-policy/" style="color:${MUTED};font-weight:normal;text-decoration:underline">Privacy Policy</a>`, { font: ARIAL, size: 12, color: MUTED, lineHeight: 1.5 }, "center"),
    ])], { border: border(["top"]), padding: spacing(22, 24, 10, 24) }),
  ],
};

async function main() {
  const html = renderDesign(design);
  const out = path.join(process.cwd(), "public/dev-samples");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "halloween.json"), JSON.stringify(design, null, 2));
  fs.writeFileSync(path.join(out, "halloween.html"), html);
  console.log(`rendered ${html.length} chars → public/dev-samples/halloween.{json,html}`);

  if (process.argv.includes("--apply")) {
    const { default: prisma } = await import("../../src/lib/prisma");
    const name = "Happy Halloween (customers)";
    const existing = await prisma.emailTemplate.findFirst({ where: { name }, select: { id: true } });
    const data = { name, subject: "Happy Halloween from your scoopers", html, designJson: design as object, category: "Holiday", adminEmail: "brandonecarr@gmail.com" };
    const row = existing
      ? await prisma.emailTemplate.update({ where: { id: existing.id }, data })
      : await prisma.emailTemplate.create({ data });
    console.log(`${existing ? "updated" : "created"} EmailTemplate ${row.id}`);
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
