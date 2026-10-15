/**
 * Brand library for the email designer: logo, fonts, colors, social links, nav links
 * and the postal address. One AppSetting row (`brand.library`) holding JSON. The
 * owner adds and removes entries from the designer's Style tab.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadBrand, saveBrand, sanitizeBrand } from "@/lib/email-designer/brand";
import type { BrandLibrary } from "@/lib/email-designer/model";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ brand: await loadBrand() });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { brand?: Partial<BrandLibrary> };
  const brand = sanitizeBrand(body.brand || {});
  await saveBrand(brand);
  return NextResponse.json({ brand });
}
