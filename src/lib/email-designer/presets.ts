/**
 * Prebuilt sections for the designer's Content → Sections tab, built from the
 * brand library so colors, logo and links are already right.
 */

import { type BrandLibrary, type Section, type Block, newSection, newBlock, spacing, DEFAULT_BRAND } from "./model";

export interface SectionPreset { key: string; label: string; hint: string; build: (brand: BrandLibrary) => Section }

const color = (brand: BrandLibrary, name: string, fb: string) => brand.colors.find((c) => c.name.toLowerCase() === name)?.hex || fb;

function titleBlock(html: string, level: 1 | 2 | 3, patch: Partial<Extract<Block, { type: "title" }>> = {}): Block {
  const b = newBlock("title"); if (b.type === "title") Object.assign(b, { html, level }, patch); return b;
}
function textBlock(html: string, patch: Partial<Extract<Block, { type: "text" }>> = {}): Block {
  const b = newBlock("text"); if (b.type === "text") Object.assign(b, { html }, patch); return b;
}
function buttonBlock(label: string, href: string, patch: Partial<Extract<Block, { type: "button" }>> = {}): Block {
  const b = newBlock("button"); if (b.type === "button") Object.assign(b, { label, href }, patch); return b;
}
const eyebrow = (text: string, colorHex: string): Block =>
  textBlock(text, { name: "Eyebrow", style: { size: 12, bold: true, letterSpacing: 2, uppercase: true, color: colorHex, lineHeight: 1.3 }, padding: spacing(0) });

export const SECTION_PRESETS: SectionPreset[] = [
  {
    key: "header", label: "Header", hint: "Logo with a phone number on the right",
    build: (brand) => {
      const s = newSection([60, 40], "Header");
      s.padding = spacing(8, 8, 18);
      s.vAlign = "middle";
      const logo = newBlock("logo", brand); if (logo.type === "logo") { logo.align = "left"; logo.padding = spacing(0); logo.width = Math.min(220, brand.logo?.width || 200); }
      const phone = textBlock(`<a href="tel:9093663744">(909) 366-3744</a>`, { align: "right", name: "Phone", style: { size: 13, bold: true }, visibility: "desktop", padding: spacing(0) });
      s.columns[0].blocks = [logo]; s.columns[0].vAlign = "middle";
      s.columns[1].blocks = [phone]; s.columns[1].vAlign = "middle";
      return s;
    },
  },
  {
    key: "hero", label: "Hero card", hint: "Eyebrow, headline, intro and a button on a white card",
    build: (brand) => {
      const s = newSection([100], "Hero card");
      s.background = "#FFFFFF"; s.radius = 22; s.border = { size: 1, color: "#E1E9EC", style: "solid" }; s.padding = spacing(40, 40, 32);
      s.columns[0].blocks = [
        eyebrow("Your quote is saved", color(brand, "blue", "#008EFF")),
        titleBlock("Hi {{firstName}}, your yard is one tap from clean.", 1, { style: { font: "Georgia, 'Times New Roman', serif", size: 36, lineHeight: 1.17, letterSpacing: -0.5 }, padding: spacing(12, 0, 0) }),
        textBlock("Thanks for getting a quote. Everything you entered is saved, so finishing takes about a minute.", { style: { size: 17, lineHeight: 1.55 }, padding: spacing(14, 0, 0) }),
        buttonBlock("Finish my signup →", "{{resumeLink}}", { padding: spacing(26, 0, 0), width: 100, widthUnit: "%" }),
      ];
      return s;
    },
  },
  {
    key: "two", label: "Two columns", hint: "Text beside text, equal widths",
    build: () => {
      const s = newSection([50, 50], "Two columns"); s.columnGap = 16;
      s.columns[0].blocks = [titleBlock("Left column", 3), textBlock("Your text here.")];
      s.columns[1].blocks = [titleBlock("Right column", 3), textBlock("Your text here.")];
      return s;
    },
  },
  {
    key: "three", label: "Three columns", hint: "Three equal columns",
    build: () => {
      const s = newSection([34, 33, 33], "Three columns"); s.columnGap = 12;
      s.columns.forEach((c, i) => { c.blocks = [titleBlock(`Column ${i + 1}`, 3, { align: "center" }), textBlock("Your text here.", { align: "center" })]; });
      return s;
    },
  },
  {
    key: "image-text", label: "Image + text", hint: "Picture on the left, copy on the right",
    build: () => {
      const s = newSection([42, 58], "Image + text"); s.columnGap = 20; s.vAlign = "middle";
      s.columns[0].blocks = [newBlock("image")];
      s.columns[1].blocks = [titleBlock("A headline for the picture", 2), textBlock("A sentence or two that explains it."), buttonBlock("Learn more", "https://doogoodscoopers.com")];
      s.columns[1].vAlign = "middle";
      return s;
    },
  },
  {
    key: "tiles", label: "Stat tiles", hint: "Three numbers on dark tiles",
    build: (brand) => {
      const ink = color(brand, "ink", "#0B1B2B"), blue = color(brand, "blue", "#008EFF"), mint = color(brand, "mint", "#9CD5CF");
      const s = newSection([34, 33, 33], "Stat tiles"); s.columnGap = 12; s.padding = spacing(8, 24);
      const tile = (c: typeof s.columns[number], bg: string, big: string, label: string, numColor: string, labelColor: string) => {
        c.background = bg; c.radius = 14; c.padding = spacing(16, 10);
        c.blocks = [
          titleBlock(big, 2, { align: "center", style: { size: 34, color: numColor, letterSpacing: -1, lineHeight: 1.1 }, padding: spacing(0) }),
          textBlock(label, { align: "center", style: { size: 11, bold: true, letterSpacing: 1.5, uppercase: true, color: labelColor, lineHeight: 1.3 }, padding: spacing(6, 0, 0) }),
        ];
      };
      tile(s.columns[0], ink, "5.0", "Google rating", mint, "#B9C6D0");
      tile(s.columns[1], ink, "{{reviewCount}}", "Five-star reviews", mint, "#B9C6D0");
      tile(s.columns[2], blue, "0", "Contracts, ever", "#FFFFFF", "#FFFFFF");
      return s;
    },
  },
  {
    key: "review", label: "Review card", hint: "Stars, a quote and who said it",
    build: (brand) => {
      const s = newSection([100], "Review card");
      s.background = color(brand, "mint", "#9CD5CF"); s.radius = 22; s.padding = spacing(28, 40);
      s.columns[0].blocks = [
        textBlock("★★★★★ <b>5.0 on Google</b>", { name: "Stars", style: { size: 18, letterSpacing: 2, color: color(brand, "ink", "#0B1B2B"), lineHeight: 1.2 }, padding: spacing(0) }),
        textBlock("“{{review1Text}}”", { name: "Quote", style: { font: "Georgia, 'Times New Roman', serif", size: 19, italic: true, color: color(brand, "ink", "#0B1B2B"), lineHeight: 1.47 }, padding: spacing(12, 0, 0) }),
        textBlock("{{review1Name}}, {{review1City}}", { name: "Attribution", style: { size: 13, bold: true, color: "#12333A" }, padding: spacing(10, 0, 0) }),
      ];
      return s;
    },
  },
  {
    key: "cta", label: "Call to action", hint: "A full-width button with a line under it",
    build: () => {
      const s = newSection([100], "Call to action"); s.padding = spacing(16, 40);
      s.columns[0].blocks = [
        buttonBlock("Finish my signup →", "{{resumeLink}}", { width: 100, widthUnit: "%", padding: spacing(0) }),
        textBlock("Resume code <b>{{resumeCode}}</b> &nbsp;·&nbsp; No contracts, ever.", { align: "center", style: { size: 13, color: "#8497A8" }, padding: spacing(12, 0, 0) }),
      ];
      return s;
    },
  },
  {
    key: "checklist", label: "Checklist", hint: "An eyebrow and four check lines",
    build: (brand) => {
      const blue = color(brand, "blue", "#008EFF");
      const s = newSection([100], "Checklist"); s.padding = spacing(22, 40, 36);
      s.columns[0].blocks = [
        eyebrow("Every visit, every time", blue),
        textBlock(`<span style="color:${blue}"><b>✓</b></span>&nbsp; The whole yard, front, back and side runs<br><span style="color:${blue}"><b>✓</b></span>&nbsp; Tools and shoes disinfected between homes<br><span style="color:${blue}"><b>✓</b></span>&nbsp; Waste bagged and placed in your black bin<br><span style="color:${blue}"><b>✓</b></span>&nbsp; A gate photo and a text when we're done`, { style: { size: 15, lineHeight: 1.6 }, padding: spacing(12, 0, 0) }),
      ];
      return s;
    },
  },
  {
    key: "social", label: "Social links", hint: "Icons for your profiles",
    build: (brand) => { const s = newSection([100], "Social"); s.padding = spacing(16, 24); s.columns[0].blocks = [newBlock("social", brand)]; return s; },
  },
  {
    key: "footer", label: "Footer", hint: "Address, why they got this, unsubscribe and privacy",
    build: (brand) => {
      const s = newSection([100], "Footer"); s.padding = spacing(22, 24, 10); s.border = null;
      s.columns[0].blocks = [
        newBlock("divider"),
        textBlock(`${brand.address}<br>You're receiving this because you requested a quote at doogoodscoopers.com.<br><a href="{{unsubscribeUrl}}">Unsubscribe</a> &nbsp;·&nbsp; <a href="https://doogoodscoopers.com/privacy-policy/">Privacy Policy</a>`, { align: "center", style: { size: 12, color: "#8497A8", lineHeight: 1.5 }, padding: spacing(8, 0, 0) }),
      ];
      return s;
    },
  },
];

export const presetByKey = (key: string) => SECTION_PRESETS.find((p) => p.key === key);
export const buildPreset = (key: string, brand: BrandLibrary = DEFAULT_BRAND): Section | null => presetByKey(key)?.build(brand) ?? null;
