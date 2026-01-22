import { PrivacyPolicyContent } from "./PrivacyPolicyContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | DooGoodScoopers",
  description:
    "Read our privacy policy to learn how DooGoodScoopers collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyContent />;
}
