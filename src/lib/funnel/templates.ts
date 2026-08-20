// One-click pre-designed screens for the funnel builder. Each template returns
// a fresh Step (new ids) that drops into a funnel and can then be re-skinned.
// Blocks are self-contained (inline styles on any html) so a template looks
// right in a brand-new funnel that has no custom CSS yet.

import type { Step } from "./types";

const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 8)}`;

export interface SectionTemplate {
  key: string;
  label: string;
  group: "Opening" | "Questions" | "Persuasion" | "Convert";
  description: string;
  make: () => Step;
}

const benefitsHtml = `<div style="text-align:left">
<div style="display:flex;gap:9px;align-items:flex-start;font-size:14px;color:#37475a;margin-bottom:8px"><span style="color:#12A150;font-weight:800">✓</span><span><b style="color:#0E2A47">Reliable weekly service</b> — we never forget, you never think about it.</span></div>
<div style="display:flex;gap:9px;align-items:flex-start;font-size:14px;color:#37475a;margin-bottom:8px"><span style="color:#12A150;font-weight:800">✓</span><span><b style="color:#0E2A47">A text when we&rsquo;re done</b> — know your yard is clean before the kids run out.</span></div>
<div style="display:flex;gap:9px;align-items:flex-start;font-size:14px;color:#37475a"><span style="color:#12A150;font-weight:800">✓</span><span><b style="color:#0E2A47">Gate left secured</b> every visit, and a safe yard for your pups.</span></div>
</div>`;

const thankYouHtml = `<div style="text-align:center;padding:6px 0">
<div style="width:64px;height:64px;border-radius:50%;background:#E7F8EE;color:#12A150;font-size:32px;line-height:64px;margin:0 auto 12px">✓</div>
<h1 style="font-size:24px;font-weight:800;color:#0E2A47;margin:0 0 6px">You&rsquo;re all set!</h1>
<p style="font-size:15px;color:#5b6b7a;margin:0">We&rsquo;ll text you shortly to schedule your first cleanup.</p>
</div>`;

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    key: "hero", label: "Full-bleed hero", group: "Opening",
    description: "Photo background, headline, stars, and a call-to-action. Add your image in Screen layout.",
    make: () => ({
      id: uid("s"), name: "Hero",
      layout: { mode: "full", vAlign: "center", hideProgress: true, textColor: "#ffffff", overlayOpacity: 50 },
      blocks: [
        { id: uid("b"), type: "heading", text: "A cleaner yard, every single week.", style: { align: "center", color: "#ffffff" } },
        { id: uid("b"), type: "text", text: "Professional pooper-scooper service for busy dog owners.", style: { align: "center", color: "#ffffff" } },
        { id: uid("b"), type: "rating", rating: 5, ratingCount: "Trusted across the Inland Empire" },
        { id: uid("b"), type: "spacer", size: 6 },
        { id: uid("b"), type: "cta", ctaKind: "next", label: "Get my free quote →" },
      ],
    }),
  },
  {
    key: "zip", label: "ZIP check opener", group: "Opening",
    description: "Ask for a ZIP to confirm service area, with trust badges. Add a branch rule to your out-of-area step.",
    make: () => ({
      id: uid("s"), name: "ZIP check",
      blocks: [
        { id: uid("b"), type: "heading", text: "Get your free quote in 60 seconds" },
        { id: uid("b"), type: "text", text: "First, let us make sure we serve your neighborhood." },
        { id: uid("b"), type: "zipCheck", label: "Check my area" },
        { id: uid("b"), type: "trustBadges", items: [{ icon: "🛡️", label: "Licensed & insured" }, { icon: "📍", label: "Locally owned" }, { icon: "↩️", label: "Cancel anytime" }], style: { marginTop: 4 } },
      ],
    }),
  },
  {
    key: "dogs", label: "How many dogs?", group: "Questions",
    description: "Single-select for the number of dogs (feeds the price estimate).",
    make: () => ({
      id: uid("s"), name: "Dogs",
      blocks: [
        { id: uid("b"), type: "heading", text: "How many dogs do you have?" },
        { id: uid("b"), type: "choice", field: "numberOfDogs", options: [
          { value: "1", label: "1 dog" }, { value: "2", label: "2 dogs" },
          { value: "3", label: "3 dogs" }, { value: "4", label: "4 or more" }] },
      ],
    }),
  },
  {
    key: "frequency", label: "How often?", group: "Questions",
    description: "Single-select for visit frequency (feeds the price estimate).",
    make: () => ({
      id: uid("s"), name: "Frequency",
      blocks: [
        { id: uid("b"), type: "heading", text: "How often should we visit?" },
        { id: uid("b"), type: "choice", field: "frequency", options: [
          { value: "once_a_week", label: "Weekly", sublabel: "Most popular — cleanest yard" },
          { value: "two_times_a_week", label: "Twice a week" },
          { value: "bi_weekly", label: "Every other week" },
          { value: "once_a_month", label: "Monthly" },
          { value: "one_time", label: "One-time cleanup" }] },
      ],
    }),
  },
  {
    key: "social", label: "Social proof", group: "Persuasion",
    description: "A rating line plus two customer testimonials.",
    make: () => ({
      id: uid("s"), name: "Social proof",
      blocks: [
        { id: uid("b"), type: "heading", text: "Loved by local dog owners", style: { align: "center" } },
        { id: uid("b"), type: "rating", rating: 5, ratingCount: "Hundreds of happy Inland Empire yards" },
        { id: uid("b"), type: "testimonial", quote: "They never miss a week and my yard is spotless. Worth every penny.", authorName: "Jordan M.", authorMeta: "Fontana, CA", rating: 5 },
        { id: uid("b"), type: "testimonial", quote: "Booking took two minutes and I got a text the moment they finished. So easy.", authorName: "Alexis R.", authorMeta: "Rancho Cucamonga", rating: 5 },
      ],
    }),
  },
  {
    key: "benefits", label: "Why choose us", group: "Persuasion",
    description: "A short benefits list with checkmarks and a continue button.",
    make: () => ({
      id: uid("s"), name: "Why us",
      blocks: [
        { id: uid("b"), type: "heading", text: "Why dog owners choose us" },
        { id: uid("b"), type: "html", html: benefitsHtml },
        { id: uid("b"), type: "cta", ctaKind: "next", label: "Continue" },
      ],
    }),
  },
  {
    key: "estimate", label: "Live price estimate", group: "Convert",
    description: "Shows the live Sweep&Go per-visit price, benefits, and a continue button.",
    make: () => ({
      id: uid("s"), name: "Estimate",
      blocks: [
        { id: uid("b"), type: "heading", text: "Here’s your price" },
        { id: uid("b"), type: "priceEstimate" },
        { id: uid("b"), type: "html", html: benefitsHtml, style: { marginTop: 4 } },
        { id: uid("b"), type: "cta", ctaKind: "next", label: "Looks great — continue" },
      ],
    }),
  },
  {
    key: "contact", label: "Contact capture", group: "Convert",
    description: "Name, phone, and email with a submit button that creates the lead.",
    make: () => ({
      id: uid("s"), name: "Contact",
      blocks: [
        { id: uid("b"), type: "heading", text: "Where should we send it?" },
        { id: uid("b"), type: "text", text: "Lock in this price. We’ll text you to schedule — no spam, ever." },
        { id: uid("b"), type: "contactForm", fields: ["firstName", "phone", "email"] },
        { id: uid("b"), type: "cta", ctaKind: "submit", label: "Get my quote" },
      ],
    }),
  },
  {
    key: "thankyou", label: "Thank you + booking", group: "Convert",
    description: "A celebratory confirmation with a button to the Sweep&Go booking handoff.",
    make: () => ({
      id: uid("s"), name: "Thank you",
      blocks: [
        { id: uid("b"), type: "html", html: thankYouHtml },
        { id: uid("b"), type: "cta", ctaKind: "booking", label: "Book my first cleanup now" },
      ],
    }),
  },
];
