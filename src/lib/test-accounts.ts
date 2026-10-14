// Test accounts: the owner's own signups, quotes and cancellations made while trying
// the Sweep&Go flow. They must never count anywhere — growth chart, goal pace, TV,
// marketing report, quote recovery, win-back audiences. Identified by the owner's
// phones, throwaway emails and the names used when testing.
//
// Extra entries can be added in Settings (AppSetting "testAccounts.extra": one email,
// phone or exact name per line) without a deploy.

import prisma from "@/lib/prisma";

/** Brandon's and Valerie's cell numbers (last 10 digits). */
export const TEST_PHONES = ["9094344706", "9095293738", "9094344444", "9095550142"];
const TEST_EMAIL = /(^|\.|\+)(\d*brandonecarr\d*|devwithbrandon\d*)@|@whitespace-consulting\.org$|@doogoodscoopers\.com$|^(none|me|mine|n|nothanks|test|quote-\d+)@|@(none|me|mine|here|test)\.com$/i;
const TEST_NAME = /\btest(ing)?\b|^bran+don\s*\d*\s+ca[nr]+r\d*$|^valerie\s+carr$|johnny\s+appleseed|alan\s+burr|johnny\s+walker|free\s+deodorizer|quote\s+request|^eewrewr|^hsuildfhgiul/i;
/** Invoice/billing name keys (lowercase, punctuation stripped) that belong to test accounts. */
export const TEST_NAME_KEYS = ["brandon carr", "valerie carr", "test test", "brandon test", "johnny appleseed", "alan burr", "johnny walker", "free deodorizer", "brandon quote request"];

const digits = (p: string | null | undefined) => (p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");

export function isTestIdentity(x: { name?: string | null; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; phones?: (string | null | undefined)[] }, extra?: Set<string>): boolean {
  const name = (x.name ?? [x.firstName, x.lastName].filter(Boolean).join(" ")).trim();
  const email = (x.email || "").trim().toLowerCase();
  const phones = [x.phone, ...(x.phones || [])].map(digits).filter((p) => p.length === 10);
  if (email && TEST_EMAIL.test(email)) return true;
  if (name && TEST_NAME.test(name)) return true;
  if (phones.some((p) => TEST_PHONES.includes(p))) return true;
  if (extra?.size) {
    if (email && extra.has(email)) return true;
    if (name && extra.has(name.toLowerCase())) return true;
    if (phones.some((p) => extra.has(p))) return true;
  }
  return false;
}

/** Entries added in Settings, normalized. */
export async function extraTestIdentities(): Promise<Set<string>> {
  const row = await prisma.appSetting.findUnique({ where: { key: "testAccounts.extra" } }).catch(() => null);
  return new Set((row?.value || "").split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean).map((s) => (/^[\d\s()+-]+$/.test(s) ? digits(s) : s)));
}

/** Prisma filter that leaves test quote leads out of counts and audiences. */
export const NOT_TEST_QUOTE_LEAD = {
  NOT: {
    OR: [
      { phone: { in: TEST_PHONES.flatMap((p) => [p, `1${p}`, `+1${p}`, `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}`]) } },
      { email: { contains: "brandonecarr", mode: "insensitive" as const } },
      { email: { contains: "devwithbrandon", mode: "insensitive" as const } },
      { email: { contains: "@doogoodscoopers.com", mode: "insensitive" as const } },
      { email: { contains: "whitespace-consulting", mode: "insensitive" as const } },
      { firstName: { contains: "test", mode: "insensitive" as const } },
      { lastName: { contains: "test", mode: "insensitive" as const } },
    ],
  },
};
