import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendCanvasserInvite } from "@/lib/canvasser-auth";

// Manage isolated canvasser accounts from /admin (System A auth). Creating one
// emails the rep a set-password invite via Brevo. No password is ever set here.

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toRow(c: { id: string; email: string; name: string; active: boolean; passwordHash: string | null; invitedAt: Date | null; lastLoginAt: Date | null; createdAt: Date }) {
  const status = !c.active ? "inactive" : c.passwordHash ? "active" : "invited";
  return {
    id: c.id, email: c.email, name: c.name, status,
    invitedAt: c.invitedAt?.toISOString() ?? null,
    lastLoginAt: c.lastLoginAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.canvasser.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ canvassers: rows.map(toRow) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, email } = await request.json().catch(() => ({}));
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || "").trim();
  if (!cleanName) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!EMAIL_RE.test(cleanEmail)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });

  const existing = await prisma.canvasser.findUnique({ where: { email: cleanEmail } });
  if (existing) return NextResponse.json({ error: "A canvasser with that email already exists" }, { status: 409 });

  const c = await prisma.canvasser.create({
    data: { email: cleanEmail, name: cleanName, active: true, createdBy: session.email },
  });
  const invite = await sendCanvasserInvite(c.id);
  return NextResponse.json({ canvasser: toRow(await prisma.canvasser.findUniqueOrThrow({ where: { id: c.id } })), invited: invite.ok, inviteError: invite.error });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action } = await request.json().catch(() => ({}));
  if (!id || !action) return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  const c = await prisma.canvasser.findUnique({ where: { id } });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "resend") {
    const invite = await sendCanvasserInvite(id);
    return NextResponse.json({ ok: invite.ok, error: invite.error });
  }
  if (action === "deactivate") {
    await prisma.canvasser.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  }
  if (action === "activate") {
    await prisma.canvasser.update({ where: { id }, data: { active: true } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.canvasser.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
