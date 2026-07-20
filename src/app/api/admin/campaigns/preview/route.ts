import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildRecipients, type AudienceFilter } from "@/lib/campaign-audience";

// POST filters → the exact recipient list (for the live count + review table).
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filters = (await request.json()) as AudienceFilter;
  if (!filters?.leadTypes?.length) {
    return NextResponse.json({ recipients: [], count: 0 });
  }
  const recipients = await buildRecipients(filters);
  return NextResponse.json({ recipients, count: recipients.length });
}
