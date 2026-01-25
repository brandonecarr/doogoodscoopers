import { PrivacyPolicyContent } from "./PrivacyPolicyContent";
import { Metadata } from "next";
import { getLegalDocumentSettings } from "@/lib/public-settings";

export const metadata: Metadata = {
  title: "Privacy Policy | DooGoodScoopers",
  description:
    "Read our privacy policy to learn how DooGoodScoopers collects, uses, and protects your personal information.",
};

export default async function PrivacyPolicyPage() {
  const settings = await getLegalDocumentSettings("privacyPolicy");

  return (
    <PrivacyPolicyContent
      dynamicSections={settings?.sections}
      lastUpdated={settings?.lastUpdated}
    />
  );
}
