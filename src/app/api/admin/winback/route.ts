import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fromDateTimeLocalValue } from "@/lib/datetime";
import { launchWinback, setWinbackActive, winbackStatus } from "@/lib/winback";

// Win-back campaign: GET progress; POST { action: "launch" | "pause" | "resume" }.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ status: await winbackStatus() });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    if (body.action === "pause" || body.action === "resume") {
      await setWinbackActive(body.action === "resume");
      return NextResponse.json({ ok: true });
    }
    if (body.action !== "launch") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    const startIso = fromDateTimeLocalValue(String(body.startAt || ""));
    const deadline = String(body.deadline || "");
    const signupLink = String(body.signupLink || "").trim();
    const includeIds: string[] = Array.isArray(body.includeIds) ? body.includeIds.filter((x: unknown) => typeof x === "string") : [];
    if (!startIso) return NextResponse.json({ error: "Pick a start date and time." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return NextResponse.json({ error: "Pick the offer's last day." }, { status: 400 });
    if (deadline < startIso.slice(0, 10)) return NextResponse.json({ error: "The offer can't end before the campaign starts." }, { status: 400 });
    if (!/^https?:\/\/\S+\.\S+/.test(signupLink)) return NextResponse.json({ error: "Enter the full signup link, starting with https://" }, { status: 400 });
    if (!includeIds.length) return NextResponse.json({ error: "Choose at least one person." }, { status: 400 });
    if (body.couponConfirmed !== true) return NextResponse.json({ error: "Confirm the WELCOMEBACK25 code exists in Sweep&Go first." }, { status: 400 });

    const result = await launchWinback({ startAt: new Date(startIso), deadline, signupLink, includeIds, adminEmail: session.email });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong" }, { status: 400 });
  }
}
