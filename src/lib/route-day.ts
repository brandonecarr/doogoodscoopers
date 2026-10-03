import prisma from "@/lib/prisma";
import { cityFromZip, normalizeZip5 } from "@/lib/geo/zipCity";

/**
 * The weekday a tech already services near a ZIP, from active customers' Sweep&Go
 * service days: the most common day in the same ZIP, else in the same city. Used to
 * personalize the voicemail script ("holding an opening on our Tuesday route").
 */
export async function nearbyRouteDay(rawZip: string | null | undefined): Promise<{ day: string; scope: "zip" | "city" } | null> {
  const zip = normalizeZip5(rawZip);
  if (!zip) return null;
  const customers = await prisma.sweepandgoCustomer.findMany({
    where: { active: true, serviceDays: { not: null } },
    select: { zipCode: true, serviceDays: true },
  });
  const mostCommon = (rows: typeof customers): string | null => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      for (const d of (r.serviceDays || "").split(",").map((s) => s.trim()).filter(Boolean)) counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const sameZip = mostCommon(customers.filter((c) => normalizeZip5(c.zipCode) === zip));
  if (sameZip) return { day: sameZip, scope: "zip" };
  const city = cityFromZip(zip);
  if (!city) return null;
  const sameCity = mostCommon(customers.filter((c) => cityFromZip(c.zipCode) === city));
  return sameCity ? { day: sameCity, scope: "city" } : null;
}
