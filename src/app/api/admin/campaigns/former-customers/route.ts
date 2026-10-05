import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { formerCustomers } from "@/lib/former-customers";

// GET → the former-customer audience for the drip builder (who can get email / text).
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ people: await formerCustomers() });
}
