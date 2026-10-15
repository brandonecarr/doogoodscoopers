/**
 * Email designer document model (design version 2).
 *
 * A design is Sections → Columns → Blocks, saved as JSON (`designJson`) next to the
 * compiled HTML the sender uses. Every element and container carries its own
 * settings and a name the owner can change. Block style fields are optional and
 * inherit from the global text/button styles when unset.
 *
 * Pure data + helpers: no React, no database, usable on the server and the client.
 */

export const DESIGN_VERSION = 2;

export type Align = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";
export type Visibility = "all" | "desktop" | "mobile";
export type SocialNetwork = "facebook" | "instagram" | "tiktok" | "youtube" | "x" | "linkedin" | "google" | "yelp" | "nextdoor" | "website";

export interface Spacing { top: number; right: number; bottom: number; left: number }
export type Side = "top" | "right" | "bottom" | "left";
export interface Border { size: number; color: string; style: "solid" | "dashed" | "dotted"; /** Default: every side. */ sides?: Side[] }
/** Show this element only when a personalization token has (or lacks) a value for the recipient. */
export interface Condition { token: string; when: "present" | "absent" }

/** Settings every block and container shares. */
export interface Box {
  id: string;
  name?: string;
  padding: Spacing;
  margin: Spacing;
  background: string | null;
  radius: number;
  /** Which corners the radius applies to (stacked sections can share one card). */
  radiusCorners?: "all" | "top" | "bottom";
  border: Border | null;
  visibility: Visibility;
  condition: Condition | null;
  /** Dark-mode overrides for this element (used when the email's dark mode is on). */
  dark?: { background?: string | null; color?: string | null };
  /** Paint behind the margin: lets a section sit inset inside a larger card (background + border around the margin area). */
  outer?: { background: string | null; border: Border | null };
}

export interface TextStyle {
  font?: string;
  size?: number;
  color?: string;
  lineHeight?: number;
  bold?: boolean;
  italic?: boolean;
  letterSpacing?: number;
  uppercase?: boolean;
}

export interface TitleBlock extends Box { type: "title"; html: string; level: 1 | 2 | 3; align: Align; style: TextStyle }
export interface TextBlock extends Box { type: "text"; html: string; align: Align; style: TextStyle }
export interface ImageBlock extends Box { type: "image"; src: string; alt: string; href: string; width: number | null; widthUnit: "px" | "%"; align: Align; imageRadius: number }
export interface LogoBlock extends Box { type: "logo"; src: string; alt: string; href: string; width: number; align: Align }
export interface ButtonBlock extends Box {
  type: "button"; label: string; href: string; align: Align;
  style: TextStyle; buttonBg?: string; buttonRadius?: number; width: number | null; widthUnit: "px" | "%"; inner: Spacing; buttonBorder: Border | null;
}
export interface DividerBlock extends Box { type: "divider"; color: string; thickness: number; width: number; lineStyle: "solid" | "dashed" | "dotted"; align: Align }
export interface SpacerBlock extends Box { type: "spacer"; height: number }
export interface SocialItem { network: SocialNetwork; url: string }
export interface SocialBlock extends Box { type: "social"; items: SocialItem[]; iconSize: number; iconStyle: "color" | "dark" | "light"; gap: number; align: Align }
export interface HtmlBlock extends Box { type: "html"; html: string }
export interface NavItem { label: string; href: string }
export interface NavigationBlock extends Box { type: "navigation"; items: NavItem[]; align: Align; gap: number; style: TextStyle; separator: string }
export interface VideoBlock extends Box { type: "video"; thumbnail: string; href: string; alt: string; width: number | null; align: Align; playButton: boolean }
export interface ProductBlock extends Box {
  type: "product"; image: string; title: string; price: string; description: string; buttonLabel: string; buttonHref: string;
  align: Align; imageWidth: number; style: TextStyle;
}
export interface DynamicBlock extends Box { type: "dynamic"; token: string; prefix: string; suffix: string; fallback: string; align: Align; style: TextStyle }

export type Block =
  | TitleBlock | TextBlock | ImageBlock | LogoBlock | ButtonBlock | DividerBlock | SpacerBlock
  | SocialBlock | HtmlBlock | NavigationBlock | VideoBlock | ProductBlock | DynamicBlock;
export type BlockType = Block["type"];

export interface Column extends Box { width: number; vAlign: VAlign; blocks: Block[] }
export interface Section extends Box { columns: Column[]; vAlign: VAlign; columnGap: number; fullWidthBg: boolean; stackOnMobile: boolean; /** Vertical space between columns once they stack on phones. */ stackGap?: number }

export interface TextRole { font: string; size: number; color: string; lineHeight: number; bold: boolean; letterSpacing: number }
export interface GlobalStyles {
  bodyWidth: number;
  /** The page behind the email. */
  pageBg: string;
  /** The email body itself. */
  bodyBg: string;
  bodyPadding: Spacing;
  bodyRadius: number;
  viewInBrowser: boolean;
  preheader: string;
  text: { paragraph: TextRole; title1: TextRole; title2: TextRole; title3: TextRole };
  link: { color: string; bold: boolean; italic: boolean; underline: boolean };
  button: { font: string; size: number; color: string; bg: string; radius: number; bold: boolean; width: number | null; inner: Spacing; borderSize: number; borderColor: string };
  /** Optional dark-mode palette (see DEFAULT_DARK). */
  dark?: Partial<DarkStyles>;
}

export interface DarkStyles { enabled: boolean; pageBg: string; bodyBg: string; text: string; link: string; sectionBg: string | null }
export const DEFAULT_DARK: DarkStyles = { enabled: false, pageBg: "#0B1220", bodyBg: "#111827", text: "#E5E7EB", link: "#7CC7FF", sectionBg: null };
/** The design's dark palette (older designs have none). */
export const darkOf = (s: GlobalStyles): DarkStyles => ({ ...DEFAULT_DARK, ...(s.dark || {}) });

export interface Design { version: 2; styles: GlobalStyles; sections: Section[] }

// ── Brand library ──────────────────────────────────────────────────────────────

export interface BrandFont { name: string; family: string; google: boolean }
export interface BrandColor { name: string; hex: string }
export interface BrandLibrary {
  logo: { url: string; alt: string; width: number } | null;
  fonts: BrandFont[];
  colors: BrandColor[];
  social: SocialItem[];
  links: NavItem[];
  address: string;
}

export const BRAND_KEY = "brand.library";

export const SYSTEM_FONTS: BrandFont[] = [
  { name: "Arial", family: "Arial, Helvetica, sans-serif", google: false },
  { name: "Helvetica", family: "Helvetica, Arial, sans-serif", google: false },
  { name: "Verdana", family: "Verdana, Geneva, sans-serif", google: false },
  { name: "Tahoma", family: "Tahoma, Verdana, sans-serif", google: false },
  { name: "Trebuchet MS", family: "'Trebuchet MS', Helvetica, sans-serif", google: false },
  { name: "Georgia", family: "Georgia, 'Times New Roman', serif", google: false },
  { name: "Times New Roman", family: "'Times New Roman', Times, serif", google: false },
  { name: "Courier New", family: "'Courier New', Courier, monospace", google: false },
];

export const GOOGLE_FAMILIES = [
  "Poppins", "Montserrat", "Roboto", "Open Sans", "Lato", "Nunito", "Nunito Sans", "Raleway", "Oswald",
  "Inter", "Work Sans", "Rubik", "Mulish", "Quicksand", "Josefin Sans", "Barlow", "Karla", "DM Sans",
  "Manrope", "Figtree", "Outfit", "Sora", "Space Grotesk", "Plus Jakarta Sans", "Archivo", "Kanit",
  "Titillium Web", "Fira Sans", "PT Sans", "Source Sans 3", "Noto Sans", "Roboto Condensed", "Roboto Mono",
  "Cabin", "Comfortaa", "Dosis", "Exo 2", "Heebo", "Hind", "IBM Plex Sans", "IBM Plex Mono", "Inconsolata",
  "Libre Franklin", "Maven Pro", "Overpass", "Oxygen", "Prompt", "Questrial", "Signika", "Teko", "Ubuntu",
  "Varela Round", "Abel", "Anton", "Bebas Neue", "Fjalla One", "Righteous", "Jost", "Lexend",
  "Red Hat Display", "Urbanist", "Assistant", "Catamaran", "Chivo", "Asap",
  "Merriweather", "Playfair Display", "Lora", "PT Serif", "Source Serif 4", "Noto Serif", "Roboto Slab",
  "Bitter", "IBM Plex Serif", "Libre Baskerville", "Cormorant Garamond", "Crimson Text", "EB Garamond",
  "Arvo", "Domine", "Vollkorn", "Cardo", "Spectral", "Frank Ruhl Libre", "Zilla Slab",
];

/** CSS family for a Google font, with a sane fallback stack. */
export function googleFamily(name: string): string {
  const serif = /Merriweather|Playfair|Lora|Serif|Slab|Bitter|Baskerville|Garamond|Crimson|Arvo|Domine|Vollkorn|Cardo|Spectral|Frank Ruhl/.test(name);
  return `'${name}', ${serif ? "Georgia, serif" : "Arial, Helvetica, sans-serif"}`;
}
export const googleFont = (name: string): BrandFont => ({ name, family: googleFamily(name), google: true });

/** The Google font names referenced by a family list, for the <link> import. */
export function googleFontsIn(families: string[]): string[] {
  const out = new Set<string>();
  for (const f of families) {
    const m = f.match(/^'([^']+)'/);
    if (m && GOOGLE_FAMILIES.includes(m[1])) out.add(m[1]);
  }
  return [...out];
}

// ── Defaults ───────────────────────────────────────────────────────────────────

export const uid = (): string => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
export const spacing = (top: number, right = top, bottom = top, left = right): Spacing => ({ top, right, bottom, left });
export const NO_SPACING: Spacing = spacing(0);

export const DEFAULT_BRAND: BrandLibrary = {
  logo: null,
  fonts: [googleFont("Poppins"), SYSTEM_FONTS[0], SYSTEM_FONTS[5]],
  colors: [
    { name: "Ink", hex: "#0B1B2B" }, { name: "Blue", hex: "#008EFF" }, { name: "Mint", hex: "#9CD5CF" },
    { name: "Body gray", hex: "#3D5265" }, { name: "Muted gray", hex: "#8497A8" }, { name: "Page", hex: "#F6FAFB" }, { name: "White", hex: "#FFFFFF" },
  ],
  social: [],
  links: [],
  address: "DooGoodScoopers · 11799 Sebastian Way, Suite 103, Rancho Cucamonga, CA 91730",
};

export function defaultStyles(brand: BrandLibrary = DEFAULT_BRAND): GlobalStyles {
  const sans = brand.fonts[0]?.family || SYSTEM_FONTS[0].family;
  const color = (n: string, fb: string) => brand.colors.find((c) => c.name.toLowerCase() === n)?.hex || fb;
  const ink = color("ink", "#0B1B2B");
  const blue = color("blue", "#008EFF");
  return {
    bodyWidth: 600,
    pageBg: color("page", "#F6FAFB"),
    bodyBg: "#FFFFFF",
    bodyPadding: spacing(0),
    bodyRadius: 0,
    viewInBrowser: false,
    preheader: "",
    text: {
      paragraph: { font: sans, size: 16, color: color("body gray", "#3D5265"), lineHeight: 1.6, bold: false, letterSpacing: 0 },
      title1: { font: sans, size: 32, color: ink, lineHeight: 1.2, bold: true, letterSpacing: -0.5 },
      title2: { font: sans, size: 24, color: ink, lineHeight: 1.3, bold: true, letterSpacing: 0 },
      title3: { font: sans, size: 19, color: ink, lineHeight: 1.35, bold: true, letterSpacing: 0 },
    },
    link: { color: blue, bold: false, italic: false, underline: true },
    button: { font: sans, size: 17, color: "#FFFFFF", bg: blue, radius: 14, bold: true, width: null, inner: spacing(16, 24), borderSize: 0, borderColor: blue },
  };
}

const box = (name?: string): Box => ({
  id: uid(), name, padding: spacing(0), margin: spacing(0), background: null, radius: 0, border: null, visibility: "all", condition: null,
});

export const BLOCK_LABEL: Record<BlockType, string> = {
  title: "Title", text: "Text", image: "Image", logo: "Logo", button: "Button", divider: "Divider", spacer: "Spacer",
  social: "Social", html: "HTML", navigation: "Navigation", video: "Video", product: "Product", dynamic: "Dynamic content",
};

/** A new block of the given type with sensible content. */
export function newBlock(type: BlockType, brand: BrandLibrary = DEFAULT_BRAND): Block {
  const b = box();
  switch (type) {
    case "title": return { ...b, type, html: "Your headline here", level: 1, align: "left", style: {}, padding: spacing(8, 0) };
    case "text": return { ...b, type, html: "Write your text here. Use the toolbar for <b>bold</b>, links and personalization like {{firstName}}.", align: "left", style: {}, padding: spacing(8, 0) };
    case "image": return { ...b, type, src: "", alt: "", href: "", width: null, widthUnit: "%", align: "center", imageRadius: 0, padding: spacing(8, 0) };
    case "logo": return { ...b, type, src: brand.logo?.url || "", alt: brand.logo?.alt || "DooGoodScoopers", href: "https://doogoodscoopers.com", width: brand.logo?.width || 220, align: "center", padding: spacing(16, 0) };
    case "button": return { ...b, type, label: "Finish my signup →", href: "{{resumeLink}}", align: "center", style: {}, width: null, widthUnit: "px", inner: spacing(16, 24), buttonBorder: null, padding: spacing(12, 0) };
    case "divider": return { ...b, type, color: "#E1E9EC", thickness: 1, width: 100, lineStyle: "solid", align: "center", padding: spacing(12, 0) };
    case "spacer": return { ...b, type, height: 24 };
    case "social": return { ...b, type, items: brand.social.length ? [...brand.social] : [{ network: "facebook", url: "https://facebook.com/" }, { network: "instagram", url: "https://instagram.com/" }], iconSize: 32, iconStyle: "color", gap: 12, align: "center", padding: spacing(12, 0) };
    case "html": return { ...b, type, html: "<p style=\"margin:0;\">Custom HTML</p>" };
    case "navigation": return { ...b, type, items: brand.links.length ? [...brand.links] : [{ label: "Services", href: "https://doogoodscoopers.com/residential-services/" }, { label: "Get a quote", href: "https://doogoodscoopers.com/get-a-quote/" }], align: "center", gap: 24, style: {}, separator: "", padding: spacing(12, 0) };
    case "video": return { ...b, type, thumbnail: "", href: "", alt: "Watch the video", width: null, align: "center", playButton: true, padding: spacing(8, 0) };
    case "product": return { ...b, type, image: "", title: "Sanitization Spray", price: "$25 per visit", description: "Kennel-grade disinfectant on every visit.", buttonLabel: "Add it", buttonHref: "{{resumeLink}}", align: "center", imageWidth: 240, style: {}, padding: spacing(12, 0) };
    case "dynamic": return { ...b, type, token: "reviewCount", prefix: "", suffix: " five-star reviews", fallback: "", align: "left", style: {}, padding: spacing(8, 0) };
  }
}

export function newColumn(width = 100, blocks: Block[] = []): Column {
  return { ...box(), width, vAlign: "top", blocks };
}
export function newSection(columnWidths: number[] = [100], name?: string): Section {
  return { ...box(name), columns: columnWidths.map((w) => newColumn(w)), vAlign: "top", columnGap: 0, fullWidthBg: false, stackOnMobile: true, padding: spacing(16, 24) };
}

export function emptyDesign(brand: BrandLibrary = DEFAULT_BRAND): Design {
  return { version: 2, styles: defaultStyles(brand), sections: [] };
}

/** Whether a stored designJson is this model (and not the retired GrapesJS project data). */
export function isDesign(x: unknown): x is Design {
  return !!x && typeof x === "object" && (x as { version?: unknown }).version === DESIGN_VERSION && Array.isArray((x as { sections?: unknown }).sections);
}

// ── Tree helpers ───────────────────────────────────────────────────────────────

export type Selection = { kind: "section"; id: string } | { kind: "column"; id: string } | { kind: "block"; id: string } | null;

export interface BlockPath { section: Section; column: Column; block: Block; si: number; ci: number; bi: number }

export function findBlock(design: Design, id: string): BlockPath | null {
  for (let si = 0; si < design.sections.length; si++) {
    const section = design.sections[si];
    for (let ci = 0; ci < section.columns.length; ci++) {
      const column = section.columns[ci];
      const bi = column.blocks.findIndex((b) => b.id === id);
      if (bi >= 0) return { section, column, block: column.blocks[bi], si, ci, bi };
    }
  }
  return null;
}
export function findColumn(design: Design, id: string): { section: Section; column: Column; si: number; ci: number } | null {
  for (let si = 0; si < design.sections.length; si++) {
    const ci = design.sections[si].columns.findIndex((c) => c.id === id);
    if (ci >= 0) return { section: design.sections[si], column: design.sections[si].columns[ci], si, ci };
  }
  return null;
}
export function findSection(design: Design, id: string): { section: Section; si: number } | null {
  const si = design.sections.findIndex((s) => s.id === id);
  return si >= 0 ? { section: design.sections[si], si } : null;
}

/** Deep copy with fresh ids (for duplicate / presets). */
export function cloneWithIds<T extends Section | Column | Block>(node: T): T {
  const copy = JSON.parse(JSON.stringify(node)) as T;
  const reid = (n: { id: string; columns?: Column[]; blocks?: Block[] }) => {
    n.id = uid();
    n.columns?.forEach(reid);
    n.blocks?.forEach(reid);
  };
  reid(copy as unknown as { id: string });
  return copy;
}

/** Every token used anywhere in the design (for the sender's condition handling and previews). */
export function tokensIn(text: string): string[] {
  return [...new Set((text.match(/\{\{\s*(\w+)\s*\}\}/g) || []).map((m) => m.replace(/[{}\s]/g, "")))];
}

/** The display name of a node: the owner's name, else its type label. */
export function nodeName(node: Section | Column | Block): string {
  if (node.name) return node.name;
  if ("columns" in node) return "Section";
  if ("blocks" in node) return "Column";
  return BLOCK_LABEL[node.type];
}
