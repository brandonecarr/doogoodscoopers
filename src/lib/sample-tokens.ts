/**
 * Sample values for personalization tokens, so a preview reads like a real message
 * instead of showing "{{reviewCount}}" (which also stretches fixed-width layouts).
 * Client-safe: no database access.
 */
export const SAMPLE_TOKENS: Record<string, string> = {
  firstName: "Jamie", lastName: "Lee", name: "Jamie Lee", city: "Fontana", zipCode: "92336",
  dogs: "2 dogs", numberOfDogs: "2", dogWord: "dogs",
  resumeLink: "https://doogoodscoopers.com/r/?c=SAMPLE", resumeCode: "KMN7YM", coupon: "WELCOME25",
  reviewLink: "https://g.page/r/review", frequency: "Weekly", monthlyRate: "$89", unsubscribeUrl: "#",
  reviewCount: "66",
  review1Text: "They text when they're on the way, send a photo of the closed gate, and my yard has never looked better.",
  review1Name: "Maria G.", review1City: "Rancho Cucamonga",
  review2Text: "Easy signup, same tech every week, and the yard is spotless. Worth every penny.",
  review2Name: "James T.", review2City: "Fontana",
};

/** Fill every known token (plain or URL-encoded, as the builder stores link tokens) with its sample value. */
export function sampleTokens(text: string): string {
  return text
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => SAMPLE_TOKENS[k] ?? m)
    .replace(/%7B%7B\s*(\w+)\s*%7D%7D/gi, (m, k) => SAMPLE_TOKENS[k] ?? m);
}
