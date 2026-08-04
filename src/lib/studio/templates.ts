// Content Studio — data model for the on-brand carousel builder.
// Add a "trending" template by appending to TEMPLATES. Add variety via themes,
// per-slide font (sans/display) and decor (paws/blob/stripe/dots/none).

export type Format = "square" | "portrait";
export const DIMS: Record<Format, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

export type Theme = "navy" | "blue" | "white" | "mint" | "ink" | "alert" | "sun";

export interface ThemeStyle {
  bg: string; fg: string; hl: string; red: string; sub: string; eyebrow: string;
  logo: "light" | "dark"; dark: boolean; decorColor: string;
}

export const THEMES: Record<Theme, ThemeStyle> = {
  navy:  { bg: "#0E2A47", fg: "#ffffff", hl: "#35B6FF", red: "#FF7A57", sub: "#D7E3F0", eyebrow: "#9CD5CF", logo: "light", dark: true,  decorColor: "#ffffff" },
  blue:  { bg: "linear-gradient(150deg,#008EEF,#00A6D6)", fg: "#ffffff", hl: "#0E2A47", red: "#FFF0EA", sub: "#EAF7FF", eyebrow: "#EAF7FF", logo: "light", dark: true, decorColor: "#ffffff" },
  white: { bg: "#ffffff", fg: "#0E2A47", hl: "#008EEF", red: "#E4572E", sub: "#3a3f43", eyebrow: "#008EEF", logo: "dark", dark: false, decorColor: "#9CD5CF" },
  mint:  { bg: "#E6F5F2", fg: "#0E2A47", hl: "#0A8F86", red: "#E4572E", sub: "#3a4b48", eyebrow: "#0A8F86", logo: "dark", dark: false, decorColor: "#5FC3B8" },
  ink:   { bg: "#14181F", fg: "#ffffff", hl: "#3AD0FF", red: "#FF6B4A", sub: "#A9B2BF", eyebrow: "#3AD0FF", logo: "light", dark: true, decorColor: "#3AD0FF" },
  alert: { bg: "linear-gradient(160deg,#E4572E,#C23B1C)", fg: "#ffffff", hl: "#FFD98A", red: "#FFFFFF", sub: "#FFE1D6", eyebrow: "#FFD98A", logo: "light", dark: true, decorColor: "#ffffff" },
  sun:   { bg: "#FFC53D", fg: "#14213D", hl: "#E4572E", red: "#E4572E", sub: "#6b551a", eyebrow: "#B0741A", logo: "dark", dark: false, decorColor: "#14213D" },
};

export type LayoutId = "cover" | "stat" | "list" | "statement" | "checklist" | "cta";
export type FontStyle = "sans" | "display";
export type Decor = "paws" | "blob" | "stripe" | "dots" | "none";

export const FONTS: { id: FontStyle; label: string }[] = [
  { id: "sans", label: "Clean (Montserrat)" },
  { id: "display", label: "Bold (Bebas)" },
];
export const DECORS: { id: Decor; label: string }[] = [
  { id: "paws", label: "Paw prints" },
  { id: "blob", label: "Soft blob" },
  { id: "stripe", label: "Accent stripe" },
  { id: "dots", label: "Dot grid" },
  { id: "none", label: "None" },
];

export type FieldType = "text" | "textarea" | "list" | "toggle";
export interface FieldDef { key: string; label: string; type: FieldType; placeholder?: string }
export interface LayoutDef { id: LayoutId; name: string; hint: string; fields: FieldDef[] }

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  cover: { id: "cover", name: "Cover / Hook", hint: "Big scroll-stopping opener", fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "🐾 Dog owners, read this" },
    { key: "title", label: "Headline (use **word** to highlight)", type: "textarea", placeholder: "Your backyard has a **dirty secret**." },
    { key: "subtitle", label: "Subtitle", type: "textarea", placeholder: "And it's quietly putting your family at risk." },
  ] },
  stat: { id: "stat", name: "Big Stat", hint: "One shocking number", fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Let that sink in" },
    { key: "stat", label: "The number", type: "text", placeholder: "23M" },
    { key: "statLabel", label: "Caption (use **word**)", type: "textarea", placeholder: "bacteria live in a **single gram**." },
  ] },
  list: { id: "list", name: "Numbered List", hint: "Teaser list — titles only", fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "The part nobody talks about" },
    { key: "title", label: "Heading", type: "textarea", placeholder: "Left in your yard, dog poop is quietly:" },
    { key: "items", label: "List items (one per line)", type: "list", placeholder: "Making your family sick" },
    { key: "lastRed", label: "Make the last item red (open loop)", type: "toggle" },
  ] },
  statement: { id: "statement", name: "Big Statement", hint: "Bold one-liner / intrigue", fields: [
    { key: "statement", label: "Statement (use **word** or ~~word~~)", type: "textarea", placeholder: "Most dog owners have ~~no idea~~ how bad it gets." },
    { key: "subtitle", label: "Subtitle", type: "textarea", placeholder: "We put the full breakdown into one free guide. 👇" },
  ] },
  checklist: { id: "checklist", name: "Checklist / Tips", hint: "Green ✓ points", fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Why hire a pro" },
    { key: "title", label: "Heading", type: "textarea", placeholder: "What you get with DooGoodScoopers:" },
    { key: "items", label: "Checklist items (one per line)", type: "list", placeholder: "Reliable weekly scooping" },
  ] },
  cta: { id: "cta", name: "Call To Action", hint: "The comment-to-DM close", fields: [
    { key: "kicker", label: "Kicker (use **word**)", type: "textarea", placeholder: "Want the full breakdown — **and the fix?**" },
    { key: "lead", label: "Card lead line", type: "text", placeholder: "Grab the free guide 👇" },
    { key: "big", label: "The comment word", type: "text", placeholder: "NO MORE POOP" },
    { key: "p", label: "Card sub-line (use **word**)", type: "textarea", placeholder: "…and I'll DM you our **FREE** guide. 🐾" },
    { key: "footer", label: "Footer", type: "text", placeholder: "doogoodscoopers.com  •  (909) 366-3744" },
  ] },
};

export interface Slide {
  id: string; layout: LayoutId; theme: Theme; font: FontStyle; decor: Decor;
  showLogo: boolean; showSwipe: boolean;
  bgImage?: string;   // data URL of an uploaded photo background
  overlay?: number;   // 0.2–0.8 scrim darkness over the photo
  fields: Record<string, string | string[] | boolean>;
}

let _id = 0;
export const newId = () => `s${Date.now().toString(36)}${_id++}`;

export function blankSlide(layout: LayoutId, theme: Theme = "white"): Slide {
  const fields: Record<string, string | string[] | boolean> = {};
  for (const f of LAYOUTS[layout].fields) fields[f.key] = f.type === "list" ? [""] : f.type === "toggle" ? false : "";
  return { id: newId(), layout, theme, font: "sans", decor: "paws", showLogo: true, showSwipe: true, fields };
}

export interface TemplateDef { id: string; name: string; desc: string; tags: string[]; slides: Omit<Slide, "id">[] }

const FOOT = "doogoodscoopers.com  •  (909) 366-3744";
type Extra = Partial<Pick<Slide, "showSwipe" | "font" | "decor" | "showLogo">>;
const s = (layout: LayoutId, theme: Theme, font: FontStyle, decor: Decor, fields: Record<string, string | string[] | boolean>, extra?: Extra): Omit<Slide, "id"> =>
  ({ layout, theme, font, decor, showLogo: extra?.showLogo ?? true, showSwipe: extra?.showSwipe ?? true, fields, ...extra });

// ── Template library — each has a distinct look (theme + font + decor) ────────
export const TEMPLATES: TemplateDef[] = [
  {
    id: "dangers-teaser", name: "Dangers Teaser", desc: "Clean & serious. Hook → shock stat → teased list → intrigue → CTA.",
    tags: ["carousel", "lead-magnet"],
    slides: [
      s("cover", "navy", "sans", "paws", { eyebrow: "🐾 Dog owners, read this", title: "Your backyard has a **dirty secret**.", subtitle: "And it's quietly putting your family, your dog, and your lawn at risk." }),
      s("stat", "blue", "sans", "blob", { eyebrow: "Let that sink in", stat: "23M", statLabel: "bacteria live in a **single gram** of dog waste. And that's the least of it." }),
      s("list", "white", "sans", "dots", { eyebrow: "The part nobody talks about", title: "Left in your yard, dog poop is quietly:", items: ["Making your family sick", "Re-infecting your dog", "Killing your lawn", "Polluting our water", "…doing one thing you'd never guess"], lastRed: true }),
      s("statement", "white", "sans", "none", { statement: "Most dog owners have ~~no idea~~ how bad it really gets — or how simple it is to fix.", subtitle: "We put the full breakdown (and the fix) into one free guide. 👇" }),
      s("cta", "navy", "sans", "paws", { kicker: "Want the full breakdown — **and the simple fix?**", lead: "Grab the free guide 👇", big: "NO MORE POOP", p: "…and I'll DM you our **FREE** guide. 🐾", footer: FOOT }, { showSwipe: false }),
    ],
  },
  {
    id: "single-stat", name: "Single Stat Post", desc: "Bold Bebas number that stops the scroll. 2-slide.",
    tags: ["stat", "bold"],
    slides: [
      s("stat", "blue", "display", "blob", { eyebrow: "Did you know?", stat: "274 lbs", statLabel: "of waste the average dog produces **every year**." }),
      s("cta", "navy", "display", "paws", { kicker: "Never deal with it again.", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** and we'll send the details. 🐾", footer: FOOT }, { showSwipe: false }),
    ],
  },
  {
    id: "five-tips", name: "5 Tips / Checklist", desc: "Soft, minty, value-first. Build trust, then a light CTA.",
    tags: ["tips", "value"],
    slides: [
      s("cover", "mint", "sans", "dots", { eyebrow: "Save this 🔖", title: "5 signs it's time to **hire a scooper**.", subtitle: "Swipe through — #4 catches most dog owners off guard." }),
      s("checklist", "white", "sans", "none", { eyebrow: "The checklist", title: "You should outsource the scooping if:", items: ["You dread going in the backyard", "You have more than one dog", "You're short on weekends", "Your lawn has 'dead spots'", "You've got kids playing out there"] }),
      s("cta", "mint", "sans", "blob", { kicker: "Sound familiar?", lead: "We've got you 👇", big: "SCOOP", p: "Comment **SCOOP** for a free quote. Weekly rates from **$20**. 🐾", footer: FOOT }, { showSwipe: false }),
    ],
  },
  {
    id: "myth-fact", name: "Myth vs Fact", desc: "Tabloid red + bold Bebas. Bust a myth — super shareable.",
    tags: ["myth", "bold", "educational"],
    slides: [
      s("statement", "alert", "display", "none", { statement: "MYTH: dog poop is **good fertilizer**.", subtitle: "It's one of the most common backyard myths. Swipe 👉" }),
      s("statement", "white", "display", "stripe", { statement: "FACT: it ~~burns your grass~~.", subtitle: "Dog waste is acidic and nitrogen-heavy — it kills your lawn and leaves yellow dead spots instead of feeding it." }),
      s("cta", "navy", "display", "paws", { kicker: "Want a lawn you can actually enjoy?", lead: "Let's talk 👇", big: "SCOOP", p: "Comment **SCOOP** for a free quote. 🐾", footer: FOOT }, { showSwipe: false }),
    ],
  },
  {
    id: "pov-relatable", name: "POV (Relatable)", desc: "Dark, edgy Bebas 'POV' hook. Highly relatable, big reach.",
    tags: ["pov", "relatable", "trending"],
    slides: [
      s("cover", "ink", "display", "stripe", { eyebrow: "POV 👀", title: "The backyard is a **minefield** again. 💩", subtitle: "Every dog owner knows the feeling. There's a better way 👉" }),
      s("statement", "white", "display", "none", { statement: "You could scoop all weekend… or ~~never touch it again~~.", subtitle: "That's exactly where we come in." }),
      s("cta", "blue", "display", "blob", { kicker: "Get your weekend back.", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** and we'll send the details. 🐾", footer: FOOT }, { showSwipe: false }),
    ],
  },
  {
    id: "three-reasons", name: "3 Reasons", desc: "Bright gold, bold headline. The save-worthy 'X reasons' format.",
    tags: ["list", "reasons", "trending"],
    slides: [
      s("cover", "sun", "display", "blob", { eyebrow: "Save this 🔖", title: "3 reasons to **never scoop poop** again.", subtitle: "Swipe — #3 is the one nobody thinks about." }),
      s("list", "white", "sans", "dots", { eyebrow: "Here's why", title: "Hiring a pro means:", items: ["Your weekends are actually yours", "A cleaner, safer yard for the kids", "We never forget — you never think about it"], lastRed: false }),
      s("cta", "navy", "sans", "paws", { kicker: "Ready to hand it off?", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** for pricing — from **$20/week**. 🐾", footer: FOOT }, { showSwipe: false }),
    ],
  },
  {
    id: "red-flags", name: "Red Flags 🚩", desc: "Urgent red + bold. The 'warning signs' format.",
    tags: ["red-flags", "bold", "trending"],
    slides: [
      s("cover", "alert", "display", "none", { eyebrow: "🚩 Red flags", title: "5 signs your backyard is a **health hazard**.", subtitle: "If you spot these, it's time to act. Swipe 👉" }),
      s("list", "white", "display", "stripe", { eyebrow: "Watch for these", title: "Your yard might be unsafe if:", items: ["There's a lingering smell", "You see flies swarming", "Brown 'burn' spots on the grass", "Your dog keeps getting sick", "You won't walk out there barefoot"], lastRed: true }),
      s("statement", "mint", "sans", "blob", { statement: "The good news? Every one of these is **fixable** — fast.", subtitle: "" }),
      s("cta", "navy", "display", "paws", { kicker: "Let's clean it up.", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** to get started. 🐾", footer: FOOT }, { showSwipe: false }),
    ],
  },
  {
    id: "before-after", name: "Before vs After", desc: "Bold transformation. Sets up the pain, sells the relief.",
    tags: ["transformation", "before-after"],
    slides: [
      s("statement", "ink", "display", "stripe", { statement: "BEFORE: a backyard you ~~can't even enjoy~~.", subtitle: "Poop everywhere, flies, and that smell. Sound familiar? 👉" }),
      s("statement", "blue", "display", "blob", { statement: "AFTER: a clean yard, **every single week**.", subtitle: "Fresh, safe, and completely done for you." }),
      s("cta", "navy", "display", "paws", { kicker: "Want the 'after'?", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** and we'll take it from here. 🐾", footer: FOOT }, { showSwipe: false }),
    ],
  },
  {
    id: "social-proof", name: "Social Proof", desc: "Reviews + a real client quote. Trust, then convert.",
    tags: ["testimonial", "trust"],
    slides: [
      s("stat", "navy", "sans", "blob", { eyebrow: "The Inland Empire trusts us", stat: "5.0★", statLabel: "across **45+ reviews** on Google." }),
      s("statement", "white", "sans", "dots", { statement: "“Great team who came out and cleaned my backyard — they got it **all**!”", subtitle: "— a happy DooGoodScoopers client" }),
      s("cta", "blue", "sans", "paws", { kicker: "Join hundreds of happy dog owners.", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** to get started. 🐾", footer: FOOT }, { showSwipe: false }),
    ],
  },
];
