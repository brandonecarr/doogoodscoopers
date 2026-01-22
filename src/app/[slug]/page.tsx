import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cities, getCityBySlug, getAllCitySlugs } from "@/lib/cityData";
import LocationPage from "@/components/LocationPage";

type Props = {
  params: Promise<{ slug: string }>;
};

// Only match URLs ending in -dog-poop-cleaners
function extractCityFromSlug(slug: string): string | null {
  const match = slug.match(/^(.+)-dog-poop-cleaners$/);
  return match ? match[1] : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const citySlug = extractCityFromSlug(slug);

  if (!citySlug) {
    return { title: "Page Not Found" };
  }

  const city = getCityBySlug(citySlug);

  if (!city) {
    return { title: "Page Not Found" };
  }

  return {
    title: `Dog Poop Cleaners in ${city.name} | Professional Pet Waste Removal`,
    description: `Professional dog poop cleanup service in ${city.name}, ${city.region}. Reliable, affordable pet waste removal. Serving zip codes: ${city.zipCodes.join(", ")}. Get a free quote today!`,
    keywords: [
      `dog poop removal ${city.name}`,
      `pet waste cleanup ${city.name}`,
      `pooper scooper ${city.name}`,
      `dog waste service ${city.region}`,
    ],
  };
}

export async function generateStaticParams() {
  return getAllCitySlugs().map((citySlug) => ({
    slug: `${citySlug}-dog-poop-cleaners`,
  }));
}

export default async function DynamicPage({ params }: Props) {
  const { slug } = await params;
  const citySlug = extractCityFromSlug(slug);

  // Only handle -dog-poop-cleaners URLs
  if (!citySlug) {
    notFound();
  }

  const city = getCityBySlug(citySlug);

  if (!city) {
    notFound();
  }

  return <LocationPage city={city} />;
}
