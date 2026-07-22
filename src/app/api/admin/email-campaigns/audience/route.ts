import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildEmailRecipients, type EmailFilters } from "@/lib/email-audience";

// Estimate the audience size for the compose screen.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { filter } = (await request.json()) as { filter: EmailFilters };
  const recipients = await buildEmailRecipients(filter || {});
  return NextResponse.json({ count: recipients.length, sample: recipients.slice(0, 5).map((r) => r.email) });
}
