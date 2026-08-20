// Shared JSON schema for a funnel. A Funnel row's `data` column is a FunnelData.
// Kept deliberately small for P1; the builder (P2) edits these same shapes.

export type BlockType =
  | "heading"
  | "text"
  | "image"
  | "zipCheck"
  | "choice"
  | "priceEstimate"
  | "contactForm"
  | "cta"
  | "html" // raw HTML escape hatch (owner-authored)
  // Design blocks (the no-code design library)
  | "video"
  | "testimonial"
  | "rating"
  | "trustBadges"
  | "divider"
  | "spacer";

export interface ChoiceOption {
  value: string;
  label: string;
  sublabel?: string;
}

/** One badge in a trust-badges row. */
export interface BadgeItem {
  icon?: string; // an emoji or short glyph
  label: string;
}

export type ContactField = "firstName" | "lastName" | "email" | "phone" | "address";

export interface Block {
  id: string;
  type: BlockType;
  // heading / text
  text?: string;
  // image
  imageUrl?: string;
  alt?: string;
  // video — a YouTube/Vimeo watch/share URL, or a direct .mp4
  videoUrl?: string;
  // testimonial / rating
  quote?: string;
  authorName?: string;
  authorMeta?: string; // e.g. "Fontana, CA" or "Weekly customer"
  avatarUrl?: string;
  rating?: number; // 0–5 (supports .5)
  ratingCount?: string; // e.g. "200+ happy dog owners"
  // trustBadges
  items?: BadgeItem[];
  // spacer — vertical space in px
  size?: number;
  // choice — writes its selected value to `field` in the answers
  field?: string; // e.g. "numberOfDogs" | "frequency"
  options?: ChoiceOption[];
  // contactForm
  fields?: ContactField[];
  // cta
  ctaKind?: "next" | "submit" | "booking" | "link";
  href?: string;
  label?: string;
  // html block — raw markup
  html?: string;
  // per-block style overrides (Heyflow-style; applied inline on the block)
  style?: BlockStyle;
}

/** A small, high-impact subset of per-block styling. Extended over time. */
export interface BlockStyle {
  color?: string;
  fontSize?: number; // px
  fontWeight?: number;
  align?: "left" | "center" | "right";
  background?: string;
  padding?: number; // px
  radius?: number; // px
  marginTop?: number; // px
}

export type GotoTarget = string; // a step id, or "@finish"

export interface BranchRule {
  field: string; // an answer key (e.g. "numberOfDogs")
  op: "eq" | "neq" | "in";
  value: string | string[];
  goto: GotoTarget;
}

export interface Step {
  id: string;
  name: string;
  blocks: Block[];
  logic?: BranchRule[]; // first matching rule wins; else next step in order
}

export interface FunnelTheme {
  primary?: string; // button / accent color
  bg?: string; // page background behind the card
  cardBg?: string; // the card surface
  text?: string; // body text color
  logoUrl?: string;
  /** Google Font family name (e.g. "Poppins"); loaded on the page. */
  fontFamily?: string;
  /** Optional explicit stylesheet URL (custom-hosted font); overrides fontFamily loading. */
  fontUrl?: string;
}

export interface FunnelSettings {
  /** "Continue to booking" CTA destination (the Sweep&Go onboarding form). */
  bookingUrl?: string;
  /** Headline shown on the browser tab / share card. */
  metaTitle?: string;
  /** Owner-authored custom CSS injected into the funnel (the escape hatch). */
  customCss?: string;
  /** Full-screen (no card) layout — the escape hatch for hand-designed pages. */
  fullBleed?: boolean;
}

export interface FunnelVariant {
  steps: Step[];
}

export interface FunnelData {
  theme?: FunnelTheme;
  settings?: FunnelSettings;
  variants: { A: FunnelVariant; B?: FunnelVariant };
  /** Percent of traffic routed to variant B (0–100). P5. */
  split?: number;
}

export const DEFAULT_BOOKING_URL =
  "https://doogoodscoopers.com/sng/doogoodscoopers-obc2w-client-onboarding/";

/** Answers collected as the visitor progresses. */
export type FunnelAnswers = Record<string, string> & {
  zipCode?: string;
  inServiceArea?: string; // "true" | "false"
  pricingZone?: string;
};
