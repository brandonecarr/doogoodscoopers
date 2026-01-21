import { AboutContent } from "./AboutContent";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us | DooGoodScoopers",
  description:
    "Meet the team behind DooGoodScoopers. Founded by Brandon and Valerie in 2024, we're dedicated to providing professional pet waste removal services in the Inland Empire.",
};

export default function AboutPage() {
  return <AboutContent />;
}
