import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSmsBalance, addFunds, setBalance, setBalanceConfig } from "@/lib/sms-balance";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getSmsBalance());
}

// POST { addFunds } | { setAmount } | { lowThreshold, costPerSegment }
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await request.json().catch(() => ({}));
  const money = (v: unknown) => {
    const n = Number.parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
  };

  if (b.addFunds !== undefined) {
    const amt = money(b.addFunds);
    if (amt === null || amt <= 0) return NextResponse.json({ error: "Enter an amount greater than 0." }, { status: 400 });
    await addFunds(amt);
  } else if (b.setAmount !== undefined) {
    const amt = money(b.setAmount);
    if (amt === null || amt < 0) return NextResponse.json({ error: "Enter a valid balance." }, { status: 400 });
    await setBalance(amt);
  } else if (b.lowThreshold !== undefined || b.costPerSegment !== undefined) {
    const low = b.lowThreshold !== undefined ? money(b.lowThreshold) : undefined;
    const cost = b.costPerSegment !== undefined ? money(b.costPerSegment) : undefined;
    if ((low !== undefined && low === null) || (cost !== undefined && cost === null)) {
      return NextResponse.json({ error: "Invalid settings value." }, { status: 400 });
    }
    await setBalanceConfig({
      lowThreshold: low ?? undefined,
      costPerSegment: cost ?? undefined,
    });
  } else {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  return NextResponse.json({ success: true, ...(await getSmsBalance()) });
}
