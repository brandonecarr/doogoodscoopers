export interface CityInfo {
  slug: string;
  name: string;
  region: string;
  zipCodes: string[];
}

export const cities: CityInfo[] = [
  { slug: "fontana", name: "Fontana", region: "San Bernardino County", zipCodes: ["92335", "92336", "92337"] },
  { slug: "rancho-cucamonga", name: "Rancho Cucamonga", region: "San Bernardino County", zipCodes: ["91701", "91730", "91737", "91739"] },
  { slug: "redlands", name: "Redlands", region: "San Bernardino County", zipCodes: ["92373", "92374", "92375"] },
  { slug: "pomona", name: "Pomona", region: "Los Angeles County", zipCodes: ["91766", "91767", "91768"] },
  { slug: "upland", name: "Upland", region: "San Bernardino County", zipCodes: ["91784", "91786"] },
  { slug: "temecula", name: "Temecula", region: "Riverside County", zipCodes: ["92590", "92591", "92592"] },
  { slug: "san-bernardino", name: "San Bernardino", region: "San Bernardino County", zipCodes: ["92401", "92404", "92405", "92407", "92408"] },
  { slug: "riverside", name: "Riverside", region: "Riverside County", zipCodes: ["92501", "92503", "92504", "92505", "92506", "92507", "92508"] },
  { slug: "ontario", name: "Ontario", region: "San Bernardino County", zipCodes: ["91761", "91762", "91764"] },
  { slug: "norco", name: "Norco", region: "Riverside County", zipCodes: ["92860"] },
  { slug: "chino", name: "Chino", region: "San Bernardino County", zipCodes: ["91708", "91710"] },
  { slug: "chino-hills", name: "Chino Hills", region: "San Bernardino County", zipCodes: ["91709"] },
  { slug: "claremont", name: "Claremont", region: "Los Angeles County", zipCodes: ["91711"] },
  { slug: "colton", name: "Colton", region: "San Bernardino County", zipCodes: ["92324"] },
  { slug: "corona", name: "Corona", region: "Riverside County", zipCodes: ["92879", "92880", "92881", "92882", "92883"] },
  { slug: "grand-terrace", name: "Grand Terrace", region: "San Bernardino County", zipCodes: ["92313"] },
  { slug: "high-desert", name: "High Desert", region: "San Bernardino County", zipCodes: ["92307", "92308", "92344", "92345", "92392", "92394", "92395"] },
  { slug: "highland", name: "Highland", region: "San Bernardino County", zipCodes: ["92346"] },
  { slug: "lake-elsinore", name: "Lake Elsinore", region: "Riverside County", zipCodes: ["92530", "92532"] },
  { slug: "montclair", name: "Montclair", region: "San Bernardino County", zipCodes: ["91763"] },
  { slug: "murrieta", name: "Murrieta", region: "Riverside County", zipCodes: ["92562", "92563"] },
  { slug: "hesperia", name: "Hesperia", region: "San Bernardino County", zipCodes: ["92344", "92345"] },
  { slug: "victorville", name: "Victorville", region: "San Bernardino County", zipCodes: ["92392", "92394", "92395"] },
  { slug: "adelanto", name: "Adelanto", region: "San Bernardino County", zipCodes: ["92301"] },
  { slug: "apple-valley", name: "Apple Valley", region: "San Bernardino County", zipCodes: ["92307", "92308"] },
];

export function getCityBySlug(slug: string): CityInfo | undefined {
  return cities.find((city) => city.slug === slug);
}

export function getAllCitySlugs(): string[] {
  return cities.map((city) => city.slug);
}
