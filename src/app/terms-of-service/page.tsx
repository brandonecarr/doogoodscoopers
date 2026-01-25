import { TermsOfServiceContent } from "./TermsOfServiceContent";
import { Metadata } from "next";
import { getLegalDocumentSettings } from "@/lib/public-settings";

// Disable caching to always fetch fresh settings
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service | DooGoodScoopers",
  description:
    "Read our terms of service for DooGoodScoopers pet waste removal services in the Inland Empire. Learn about billing, scheduling, and service policies.",
};

export default async function TermsOfServicePage() {
  const settings = await getLegalDocumentSettings("termsOfService");

  return (
    <TermsOfServiceContent
      dynamicSections={settings?.sections}
      lastUpdated={settings?.lastUpdated}
    />
  );
}
