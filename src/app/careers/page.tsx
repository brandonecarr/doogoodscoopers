import { permanentRedirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers | DooGoodScoopers",
  description:
    "Join the DooGoodScoopers team! We're hiring pet waste removal technicians in the Inland Empire. Apply today for flexible hours and outdoor work.",
};

// Hiring runs off ONE application form, on the marketing site. This app used to
// host a second one, which meant two places to watch and two ways for a candidate
// to be missed. Applications now arrive from doogoodscoopers.com via
// /api/webhooks/careers, so this route just forwards there.
// (The form component is kept in CareersContent.tsx — nothing is deleted.)
const CAREERS_URL = "https://doogoodscoopers.com/careers/";

export default function CareersPage() {
  permanentRedirect(CAREERS_URL);
}
