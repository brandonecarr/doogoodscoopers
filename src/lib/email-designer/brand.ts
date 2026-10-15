/** Server-side brand library access (the designer's logo, fonts, colors, social links). */

import prisma from "@/lib/prisma";
import { BRAND_KEY, DEFAULT_BRAND, SYSTEM_FONTS, googleFont, GOOGLE_FAMILIES, type BrandLibrary, type SocialNetwork } from "./model";

const HEX = /^#[0-9a-fA-F]{3,8}$/;
export const NETWORKS: SocialNetwork[] = ["facebook", "instagram", "tiktok", "youtube", "x", "linkedin", "google", "yelp", "nextdoor", "website"];

export async function loadBrand(): Promise<BrandLibrary> {
  const row = await prisma.appSetting.findUnique({ where: { key: BRAND_KEY } });
  if (!row) return DEFAULT_BRAND;
  try {
    const parsed = JSON.parse(row.value) as Partial<BrandLibrary>;
    return { ...DEFAULT_BRAND, ...parsed, fonts: parsed.fonts?.length ? parsed.fonts : DEFAULT_BRAND.fonts, colors: parsed.colors?.length ? parsed.colors : DEFAULT_BRAND.colors };
  } catch {
    return DEFAULT_BRAND;
  }
}

export async function saveBrand(brand: BrandLibrary): Promise<void> {
  await prisma.appSetting.upsert({ where: { key: BRAND_KEY }, create: { key: BRAND_KEY, value: JSON.stringify(brand) }, update: { value: JSON.stringify(brand) } });
}

/** Validates owner input into a well-formed library. */
export function sanitizeBrand(input: Partial<BrandLibrary>): BrandLibrary {
  const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const logo = input.logo && typeof input.logo === "object" && str(input.logo.url)
    ? { url: str(input.logo.url, 600), alt: str(input.logo.alt, 120) || "Logo", width: Math.min(600, Math.max(40, Number(input.logo.width) || 220)) }
    : null;
  const fonts = (Array.isArray(input.fonts) ? input.fonts : [])
    .map((f) => {
      const name = str(f?.name, 60);
      if (!name) return null;
      const sys = SYSTEM_FONTS.find((s) => s.name === name);
      if (sys) return sys;
      if (GOOGLE_FAMILIES.includes(name)) return googleFont(name);
      return str(f?.family, 200) ? { name, family: str(f.family, 200), google: false } : null;
    })
    .filter((f): f is NonNullable<typeof f> => !!f)
    .slice(0, 12);
  const colors = (Array.isArray(input.colors) ? input.colors : [])
    .map((c) => ({ name: str(c?.name, 40) || "Color", hex: str(c?.hex, 9) }))
    .filter((c) => HEX.test(c.hex))
    .slice(0, 24);
  const social = (Array.isArray(input.social) ? input.social : [])
    .map((s) => ({ network: s?.network as SocialNetwork, url: str(s?.url, 400) }))
    .filter((s) => NETWORKS.includes(s.network) && /^https?:\/\//.test(s.url))
    .slice(0, 10);
  const links = (Array.isArray(input.links) ? input.links : [])
    .map((l) => ({ label: str(l?.label, 60), href: str(l?.href, 400) }))
    .filter((l) => l.label && /^(https?:\/\/|\{\{)/.test(l.href))
    .slice(0, 10);
  return { logo, fonts: fonts.length ? fonts : DEFAULT_BRAND.fonts, colors: colors.length ? colors : DEFAULT_BRAND.colors, social, links, address: str(input.address, 200) || DEFAULT_BRAND.address };
}
