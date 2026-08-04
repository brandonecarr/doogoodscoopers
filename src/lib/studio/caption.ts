import type { Slide } from "./templates";

const plain = (s: unknown) =>
  (typeof s === "string" ? s : "").replace(/\*\*/g, "").replace(/~~/g, "").replace(/\n/g, " ").trim();

const HASHTAGS = "#pooperscooper #dogpoop #inlandempire #dogsofinstagram #yardcleanup #petwaste #ranchocucamonga #doogoodscoopers";

/** Build a ready-to-paste IG caption from the carousel's own content. styleIdx cycles the tone. */
export function generateCaption(slides: Slide[], styleIdx = 0): string {
  const cover = slides.find((s) => s.layout === "cover");
  const stmt = slides.find((s) => s.layout === "statement");
  const hook = plain(cover?.fields.title) || plain(stmt?.fields.statement) || "Your backyard has a dirty secret.";
  const cta = slides.find((s) => s.layout === "cta");
  const keyword = (plain(cta?.fields.big) || "SCOOP").toUpperCase();

  const styles = [
    // 0 — curiosity
    `${hook} 🐾\n\nMost dog owners have no idea what that waste is really doing to their yard, their dog, and their family.\n\n👉 Comment "${keyword}" and I'll DM you the full breakdown (and the simple fix).\n\nServing the Inland Empire 🐶\n\n${HASHTAGS}`,
    // 1 — direct offer
    `🚨 ${hook}\n\nWe make it disappear — reliably, every single week.\n\n💬 Comment "${keyword}" for a free quote. Weekly rates start at just $20.\n\n📍 Proudly serving the Inland Empire\n\n${HASHTAGS}`,
    // 2 — relatable / question
    `${hook}\n\nTired of dealing with it yourself? Same. 😅\n\nComment "${keyword}" 👇 and we'll take it off your plate for good.\n\n${HASHTAGS}`,
  ];
  return styles[((styleIdx % styles.length) + styles.length) % styles.length];
}

export const CAPTION_STYLES = ["Curiosity", "Direct offer", "Relatable"];
