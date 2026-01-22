import { TermsOfServiceContent } from "./TermsOfServiceContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | DooGoodScoopers",
  description:
    "Read our terms of service for DooGoodScoopers pet waste removal services in the Inland Empire. Learn about billing, scheduling, and service policies.",
};

export default function TermsOfServicePage() {
  return <TermsOfServiceContent />;
}
