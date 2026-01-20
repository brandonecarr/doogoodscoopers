import type { Metadata } from "next";
import { QuotePageContent } from "./QuotePageContent";

export const metadata: Metadata = {
  title: "Get a Free Quote",
  description:
    "Get a free, no-obligation quote for professional dog waste removal service. Serving the Inland Empire with flexible scheduling options.",
};

export default function QuotePage() {
  return <QuotePageContent />;
}
