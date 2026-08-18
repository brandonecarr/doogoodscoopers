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
  | "cta";

export interface ChoiceOption {
  value: string;
  label: string;
  sublabel?: string;
}

export type ContactField = "firstName" | "lastName" | "email" | "phone" | "address";

export interface Block {
  id: string;
  type: BlockType;
  // heading / text
  text?: string;
  // image
  imageUrl?: string;
  // choice — writes its selected value to `field` in the answers
  field?: string; // e.g. "numberOfDogs" | "frequency"
  options?: ChoiceOption[];
  // contactForm
  fields?: ContactField[];
  // cta
  ctaKind?: "next" | "submit" | "booking" | "link";
  href?: string;
  label?: string;
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
  bg?: string;
  logoUrl?: string;
}

export interface FunnelSettings {
  /** "Continue to booking" CTA destination (the Sweep&Go onboarding form). */
  bookingUrl?: string;
  /** Headline shown on the browser tab / share card. */
  metaTitle?: string;
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
