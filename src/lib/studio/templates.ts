// Content Studio — data model for the on-brand carousel builder.
// Adding a new "trending" template = appending to TEMPLATES. Adding a new layout
// = a new LayoutId + a case in SlideCanvas + an entry in LAYOUTS.

export type Format = "square" | "portrait";
export const DIMS: Record<Format, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
};

export type Theme = "navy" | "blue" | "white" | "mint";

export interface ThemeStyle {
  bg: string;
  fg: string;
  hl: string;        // highlight color for **text**
  red: string;       // for ~~text~~ and "danger" accents
  sub: string;       // muted/subtitle text
  eyebrow: string;
  paw: string;       // rgba for paw watermark
  logo: "light" | "dark";
  dark: boolean;
}

export const THEMES: Record<Theme, ThemeStyle> = {
  navy:  { bg: "#0E2A47", fg: "#ffffff", hl: "#008EEF", red: "#FF7A57", sub: "#D7E3F0", eyebrow: "#9CD5CF", paw: "rgba(255,255,255,.06)", logo: "light", dark: true },
  blue:  { bg: "linear-gradient(150deg,#008EEF,#00A6D6)", fg: "#ffffff", hl: "#0E2A47", red: "#FFF0EA", sub: "#EAF7FF", eyebrow: "#EAF7FF", paw: "rgba(255,255,255,.09)", logo: "light", dark: true },
  white: { bg: "#ffffff", fg: "#0E2A47", hl: "#008EEF", red: "#E4572E", sub: "#3a3f43", eyebrow: "#008EEF", paw: "rgba(156,213,207,.30)", logo: "dark", dark: false },
  mint:  { bg: "#EAF6F4", fg: "#0E2A47", hl: "#008EEF", red: "#E4572E", sub: "#3a3f43", eyebrow: "#0A6FB8", paw: "rgba(156,213,207,.55)", logo: "dark", dark: false },
};

export type LayoutId = "cover" | "stat" | "list" | "statement" | "checklist" | "cta";

export type FieldType = "text" | "textarea" | "list" | "toggle";
export interface FieldDef { key: string; label: string; type: FieldType; placeholder?: string }

export interface LayoutDef {
  id: LayoutId;
  name: string;
  hint: string;
  fields: FieldDef[];
}

// Markup supported in text fields: **accent**, ~~red~~ (rendered in SlideCanvas).
export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  cover: {
    id: "cover", name: "Cover / Hook", hint: "Big scroll-stopping opener",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "🐾 Dog owners, read this" },
      { key: "title", label: "Headline (use **word** to highlight)", type: "textarea", placeholder: "Your backyard has a **dirty secret**." },
      { key: "subtitle", label: "Subtitle", type: "textarea", placeholder: "And it's quietly putting your family at risk." },
    ],
  },
  stat: {
    id: "stat", name: "Big Stat", hint: "One shocking number",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Let that sink in" },
      { key: "stat", label: "The number", type: "text", placeholder: "23M" },
      { key: "statLabel", label: "Caption (use **word** to highlight)", type: "textarea", placeholder: "bacteria live in a **single gram** of dog waste." },
    ],
  },
  list: {
    id: "list", name: "Numbered List", hint: "Teaser list — titles only",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "The part nobody talks about" },
      { key: "title", label: "Heading", type: "textarea", placeholder: "Left in your yard, dog poop is quietly:" },
      { key: "items", label: "List items (one per line)", type: "list", placeholder: "Making your family sick" },
      { key: "lastRed", label: "Make the last item red (open loop)", type: "toggle" },
    ],
  },
  statement: {
    id: "statement", name: "Big Statement", hint: "Bold one-liner / intrigue",
    fields: [
      { key: "statement", label: "Statement (use **word** or ~~word~~)", type: "textarea", placeholder: "Most dog owners have ~~no idea~~ how bad it gets." },
      { key: "subtitle", label: "Subtitle", type: "textarea", placeholder: "We put the full breakdown into one free guide. 👇" },
    ],
  },
  checklist: {
    id: "checklist", name: "Checklist / Tips", hint: "Green ✓ points",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", placeholder: "Why hire a pro" },
      { key: "title", label: "Heading", type: "textarea", placeholder: "What you get with DooGoodScoopers:" },
      { key: "items", label: "Checklist items (one per line)", type: "list", placeholder: "Reliable weekly scooping" },
    ],
  },
  cta: {
    id: "cta", name: "Call To Action", hint: "The comment-to-DM close",
    fields: [
      { key: "kicker", label: "Kicker (use **word** to highlight)", type: "textarea", placeholder: "Want the full breakdown — **and the fix?**" },
      { key: "lead", label: "Card lead line", type: "text", placeholder: "Grab the free guide 👇" },
      { key: "big", label: "Big action (the comment word)", type: "text", placeholder: "NO MORE POOP" },
      { key: "p", label: "Card sub-line (use **word**)", type: "textarea", placeholder: "…and I'll DM you our **FREE** guide. 🐾" },
      { key: "footer", label: "Footer", type: "text", placeholder: "doogoodscoopers.com  •  (909) 366-3744" },
    ],
  },
};

export interface Slide {
  id: string;
  layout: LayoutId;
  theme: Theme;
  showLogo: boolean;
  showSwipe: boolean;
  fields: Record<string, string | string[] | boolean>;
}

let _id = 0;
export const newId = () => `s${Date.now().toString(36)}${_id++}`;

export function blankSlide(layout: LayoutId, theme: Theme = "white"): Slide {
  const fields: Record<string, string | string[] | boolean> = {};
  for (const f of LAYOUTS[layout].fields) {
    fields[f.key] = f.type === "list" ? [""] : f.type === "toggle" ? false : "";
  }
  return { id: newId(), layout, theme, showLogo: true, showSwipe: true, fields };
}

export interface TemplateDef {
  id: string;
  name: string;
  desc: string;
  tags: string[];
  slides: Omit<Slide, "id">[];
}

const s = (layout: LayoutId, theme: Theme, fields: Record<string, string | string[] | boolean>, extra?: Partial<Slide>): Omit<Slide, "id"> =>
  ({ layout, theme, showLogo: true, showSwipe: extra?.showSwipe ?? true, fields, ...extra });

// ── Starter / trending template library ──────────────────────────────────────
export const TEMPLATES: TemplateDef[] = [
  {
    id: "dangers-teaser", name: "Dangers Teaser", desc: "Hook → shock stat → teased list → intrigue → CTA. The comment-to-DM lead magnet.",
    tags: ["carousel", "lead-magnet", "teaser"],
    slides: [
      s("cover", "navy", { eyebrow: "🐾 Dog owners, read this", title: "Your backyard has a **dirty secret**.", subtitle: "And it's quietly putting your family, your dog, and your lawn at risk." }),
      s("stat", "blue", { eyebrow: "Let that sink in", stat: "23M", statLabel: "bacteria live in a **single gram** of dog waste. And that's the least of it." }),
      s("list", "white", { eyebrow: "The part nobody talks about", title: "Left in your yard, dog poop is quietly:", items: ["Making your family sick", "Re-infecting your dog", "Killing your lawn", "Polluting our water", "…doing one thing you'd never guess"], lastRed: true }),
      s("statement", "white", { statement: "Most dog owners have ~~no idea~~ how bad it really gets — or how simple it is to fix.", subtitle: "We put the full breakdown (and the fix) into one free guide. 👇" }),
      s("cta", "navy", { kicker: "Want the full breakdown — **and the simple fix?**", lead: "Grab the free guide 👇", big: "NO MORE POOP", p: "…and I'll DM you our **FREE** guide to the hidden dangers of dog waste. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" }, { showSwipe: false }),
    ],
  },
  {
    id: "single-stat", name: "Single Stat Post", desc: "One punchy stat + CTA. Great as a single image or 2-slide.",
    tags: ["stat", "single"],
    slides: [
      s("stat", "blue", { eyebrow: "Did you know?", stat: "274 lbs", statLabel: "of waste the average dog produces **every year**." }),
      s("cta", "navy", { kicker: "Never deal with it again.", lead: "Get your free quote 👇", big: "SCOOP", p: "Comment **SCOOP** and we'll send you the details. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" }, { showSwipe: false }),
    ],
  },
  {
    id: "five-tips", name: "5 Tips / Checklist", desc: "Value-first list post — build trust, soft CTA.",
    tags: ["tips", "list", "value"],
    slides: [
      s("cover", "navy", { eyebrow: "Save this 🔖", title: "5 signs it's time to **hire a scooper**.", subtitle: "Swipe through — #4 catches most dog owners off guard." }),
      s("checklist", "white", { eyebrow: "The checklist", title: "You should outsource the scooping if:", items: ["You dread going in the backyard", "You have more than one dog", "You're short on weekends", "Your lawn has 'dead spots'", "You've got kids playing out there"] }),
      s("cta", "blue", { kicker: "Sound familiar?", lead: "We've got you 👇", big: "SCOOP", p: "Comment **SCOOP** for a free quote. Weekly rates from **$20**. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" }, { showSwipe: false }),
    ],
  },
  {
    id: "myth-fact", name: "Myth vs Fact", desc: "Bust a common myth — highly shareable format.",
    tags: ["myth", "educational"],
    slides: [
      s("statement", "navy", { statement: "MYTH: Dog poop is **good fertilizer**.", subtitle: "It's one of the most common backyard myths. Swipe 👉" }),
      s("statement", "white", { statement: "FACT: It ~~burns your grass~~.", subtitle: "Dog waste is acidic and nitrogen-heavy — it kills your lawn and leaves yellow dead spots instead of feeding it." }),
      s("cta", "navy", { kicker: "Want a lawn you can actually enjoy?", lead: "Let's talk 👇", big: "SCOOP", p: "Comment **SCOOP** for a free quote. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" }, { showSwipe: false }),
    ],
  },
  {
    id: "pov-relatable", name: "POV (Relatable)", desc: "Trend-y 'POV' hook — highly relatable, great reach.",
    tags: ["pov", "relatable", "trending"],
    slides: [
      s("cover", "navy", { eyebrow: "POV 👀", title: "It's Saturday morning and your backyard is a **minefield**. 💩", subtitle: "Every dog owner knows the feeling. There's a better way 👉" }),
      s("statement", "white", { statement: "You could spend your weekend scooping… or you could ~~never touch it again~~.", subtitle: "That's exactly where we come in." }),
      s("cta", "blue", { kicker: "Get your weekend back.", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** and we'll send the details. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" }, { showSwipe: false }),
    ],
  },
  {
    id: "three-reasons", name: "3 Reasons", desc: "The 'X reasons' save-worthy format. Punchy list + CTA.",
    tags: ["list", "reasons", "trending"],
    slides: [
      s("cover", "navy", { eyebrow: "Save this 🔖", title: "3 reasons to **never scoop poop** again.", subtitle: "Swipe — #3 is the one nobody thinks about." }),
      s("list", "white", { eyebrow: "Here's why", title: "Hiring a pro means:", items: ["Your weekends are actually yours", "A cleaner, safer yard for the kids", "We never forget — you never think about it"], lastRed: false }),
      s("cta", "navy", { kicker: "Ready to hand it off?", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** for pricing — from **$20/week**. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" }, { showSwipe: false }),
    ],
  },
  {
    id: "red-flags", name: "Red Flags 🚩", desc: "The 'warning signs' format — scroll-stopping and educational.",
    tags: ["red-flags", "educational", "trending"],
    slides: [
      s("cover", "navy", { eyebrow: "🚩 Red flags", title: "5 signs your backyard is a **health hazard**.", subtitle: "If you spot these, it's time to act. Swipe 👉" }),
      s("list", "white", { eyebrow: "Watch for these", title: "Your yard might be unsafe if:", items: ["There's a lingering smell", "You see flies swarming", "Brown 'burn' spots on the grass", "Your dog keeps getting sick", "You won't walk out there barefoot"], lastRed: true }),
      s("statement", "mint", { statement: "The good news? Every one of these is **fixable** — fast.", subtitle: "" }),
      s("cta", "navy", { kicker: "Let's clean it up.", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** to get started. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" }, { showSwipe: false }),
    ],
  },
  {
    id: "before-after", name: "Before vs After", desc: "Transformation format — sets up the pain, sells the relief.",
    tags: ["transformation", "before-after"],
    slides: [
      s("statement", "navy", { statement: "BEFORE: a backyard you ~~can't even enjoy~~.", subtitle: "Poop everywhere, flies, and that smell. Sound familiar? 👉" }),
      s("statement", "blue", { statement: "AFTER: a clean yard, **every single week**.", subtitle: "Fresh, safe, and completely done for you." }),
      s("cta", "navy", { kicker: "Want the 'after'?", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** and we'll take it from here. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" }, { showSwipe: false }),
    ],
  },
  {
    id: "social-proof", name: "Social Proof", desc: "Reviews + a client quote — build trust, then convert.",
    tags: ["testimonial", "social-proof", "trust"],
    slides: [
      s("stat", "navy", { eyebrow: "The Inland Empire trusts us", stat: "5.0★", statLabel: "across **45+ reviews** on Google." }),
      s("statement", "white", { statement: "“Great team who came out and cleaned my backyard — they got it **all**!”", subtitle: "— a happy DooGoodScoopers client" }),
      s("cta", "blue", { kicker: "Join hundreds of happy dog owners.", lead: "Free quote 👇", big: "SCOOP", p: "Comment **SCOOP** to get started. 🐾", footer: "doogoodscoopers.com  •  (909) 366-3744" }, { showSwipe: false }),
    ],
  },
];
