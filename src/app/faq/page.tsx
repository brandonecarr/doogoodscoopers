import { FAQContent } from "./FAQContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ | DooGoodScoopers",
  description:
    "Frequently asked questions about DooGoodScoopers pet waste removal services. Learn about pricing, scheduling, service areas, and more.",
};

export default function FAQPage() {
  return <FAQContent />;
}
