import { CommercialServicesContent } from "./CommercialServicesContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Commercial Services | Doo Good Scoopers",
  description:
    "Professional pet waste management for HOAs, apartment complexes, and commercial properties in the Inland Empire. Free consultation and customized plans.",
};

export default function CommercialServicesPage() {
  return <CommercialServicesContent />;
}
