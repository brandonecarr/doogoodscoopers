import { ResidentialServicesContent } from "./ResidentialServicesContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Residential Services | DooGoodScoopers",
  description:
    "Professional pet waste removal services for the Inland Empire. Weekly, bi-weekly, or one-time cleanings with trained technicians.",
};

export default function ResidentialServicesPage() {
  return <ResidentialServicesContent />;
}
