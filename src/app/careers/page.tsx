import { CareersContent } from "./CareersContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers | DooGoodScoopers",
  description:
    "Join the DooGoodScoopers team! We're hiring pet waste removal technicians in the Inland Empire. Apply today for flexible hours and outdoor work.",
};

export default function CareersPage() {
  return <CareersContent />;
}
