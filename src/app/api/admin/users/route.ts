import { NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Admin (CRM) user accounts. Every admin is equal — there is one role — so the
// only guard rails are: you can't delete yourself, and the last admin can't be
// deleted. Passwords are bcrypt-hashed; never returned.
export const dynamic = "force-dynamic";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PW = 10;
const row = (u: { id: string; email: string; name: string | null; createdAt: Date; updatedAt: Date }) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() });

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const users = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, createdAt: true, updatedAt: true } });
  return NextResponse.json({ users: users.map(row), me: session.email });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase(); const name = String(b.name || "").trim(); const password = String(b.password || "");
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  if (password.length < MIN_PW) return NextResponse.json({ error: `Password must be at least ${MIN_PW} characters` }, { status: 400 });
  if (await prisma.adminUser.findUnique({ where: { email } })) return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  const u = await prisma.adminUser.create({ data: { email, name: name || null, passwordHash: await hashPassword(password) } });
  await prisma.activityLog.create({ data: { action: "ADMIN_USER_CREATED", leadType: "QUOTE_FORM", leadId: u.id, details: { email }, adminEmail: session.email } }).catch(() => {});
  return NextResponse.json({ user: row(u) });
}

/** { id, name? , password? } — rename and/or reset password. */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const u = b.id ? await prisma.adminUser.findUnique({ where: { id: String(b.id) } }) : null;
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data: { name?: string | null; passwordHash?: string } = {};
  if (typeof b.name === "string") data.name = b.name.trim() || null;
  if (typeof b.password === "string" && b.password) {
    if (b.password.length < MIN_PW) return NextResponse.json({ error: `Password must be at least ${MIN_PW} characters` }, { status: 400 });
    data.passwordHash = await hashPassword(b.password);
  }
  const updated = await prisma.adminUser.update({ where: { id: u.id }, data });
  if (data.passwordHash) await prisma.activityLog.create({ data: { action: "ADMIN_USER_PASSWORD_RESET", leadType: "QUOTE_FORM", leadId: u.id, details: { email: u.email }, adminEmail: session.email } }).catch(() => {});
  return NextResponse.json({ user: row(updated) });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json().catch(() => ({}));
  const u = id ? await prisma.adminUser.findUnique({ where: { id: String(id) } }) : null;
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (u.email === session.email) return NextResponse.json({ error: "You can't delete the account you're signed in with" }, { status: 400 });
  if ((await prisma.adminUser.count()) <= 1) return NextResponse.json({ error: "There must be at least one admin" }, { status: 400 });
  await prisma.adminUser.delete({ where: { id: u.id } });
  await prisma.activityLog.create({ data: { action: "ADMIN_USER_DELETED", leadType: "QUOTE_FORM", leadId: u.id, details: { email: u.email }, adminEmail: session.email } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
