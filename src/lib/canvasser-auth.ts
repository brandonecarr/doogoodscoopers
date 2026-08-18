import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { brevoSend, isBrevoConfigured } from "@/lib/brevo-email";

// Isolated canvasser auth — its own accounts, own login, own cookie session.
// Completely separate from the /admin (AdminUser) login and the /app Supabase
// staff system. Mirrors the admin session mechanism (bcrypt + base64 cookie).

const SESSION_COOKIE = "canvasser_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (field reps stay signed in)
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // invite link valid 7 days
const FROM = "DooGoodScoopers <service@doogoodscoopers.com>";

export interface CanvasserSession { id: string; email: string; name: string }

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://doogoodscoopers.vercel.app").replace(/\/$/, "");
}
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// ── Session ──────────────────────────────────────────────────────────────────
export async function createCanvasserSession(c: { id: string; email: string }): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const encoded = Buffer.from(JSON.stringify({ id: c.id, email: c.email, token, createdAt: Date.now() })).toString("base64");
  const store = await cookies();
  store.set(SESSION_COOKIE, encoded, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: SESSION_MAX_AGE, path: "/",
  });
}

export async function getCanvasserSession(): Promise<CanvasserSession | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const s = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    if (!s?.id || Date.now() - s.createdAt > SESSION_MAX_AGE * 1000) return null;
    const c = await prisma.canvasser.findUnique({ where: { id: s.id } });
    if (!c || !c.active || !c.passwordHash) return null;
    return { id: c.id, email: c.email, name: c.name };
  } catch {
    return null;
  }
}

export async function destroyCanvasserSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// ── Login ────────────────────────────────────────────────────────────────────
export async function canvasserLogin(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const c = await prisma.canvasser.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!c || !c.active || !c.passwordHash) return { ok: false, error: "Invalid email or password" };
  if (!(await bcrypt.compare(password, c.passwordHash))) return { ok: false, error: "Invalid email or password" };
  await createCanvasserSession(c);
  await prisma.canvasser.update({ where: { id: c.id }, data: { lastLoginAt: new Date() } });
  return { ok: true };
}

// ── Invites ──────────────────────────────────────────────────────────────────
/** Generate a fresh invite token, store its hash + expiry, and return the raw token. */
async function issueInviteToken(canvasserId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.canvasser.update({
    where: { id: canvasserId },
    data: { inviteTokenHash: sha256(token), inviteExpires: new Date(Date.now() + INVITE_TTL_MS), invitedAt: new Date() },
  });
  return token;
}

/** Email a set-password invite link. Returns an error string on failure. */
export async function sendCanvasserInvite(canvasserId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isBrevoConfigured()) return { ok: false, error: "Email service (Brevo) is not configured." };
  const c = await prisma.canvasser.findUnique({ where: { id: canvasserId } });
  if (!c) return { ok: false, error: "Canvasser not found" };
  const token = await issueInviteToken(canvasserId);
  const link = `${siteUrl()}/canvasser/set-password?token=${token}`;
  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h2 style="color:#0E2A47">You're invited to canvass for DooGoodScoopers 🐾</h2>
      <p>Hi ${c.name || "there"}, you've been set up as a canvasser. Tap the button below to create your password and start using the canvasser map on your phone.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#6D3EF0;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;display:inline-block">Set your password</a>
      </p>
      <p style="color:#666;font-size:13px">This link expires in 7 days. If the button doesn't work, paste this into your browser:<br>${link}</p>
    </div>`;
  const res = await brevoSend({
    from: { name: "DooGoodScoopers", email: "service@doogoodscoopers.com" },
    to: [{ email: c.email, name: c.name || undefined }],
    subject: "Set up your DooGoodScoopers canvasser login",
    html,
    text: `You've been invited as a DooGoodScoopers canvasser. Set your password: ${link} (expires in 7 days).`,
    tags: ["canvasser-invite"],
  });
  return res.error ? { ok: false, error: res.error } : { ok: true };
}

/** Resolve an invite token to its canvasser (if valid + unexpired). */
export async function canvasserForInvite(token: string): Promise<{ id: string; email: string; name: string } | null> {
  if (!token) return null;
  const c = await prisma.canvasser.findUnique({ where: { inviteTokenHash: sha256(token) } });
  if (!c || !c.inviteExpires || c.inviteExpires < new Date()) return null;
  return { id: c.id, email: c.email, name: c.name };
}

/** Accept an invite: set the password, clear the token, activate, and sign in. */
export async function acceptCanvasserInvite(token: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (!password || password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  const c = await prisma.canvasser.findUnique({ where: { inviteTokenHash: sha256(token) } });
  if (!c || !c.inviteExpires || c.inviteExpires < new Date()) return { ok: false, error: "This invite link is invalid or has expired." };
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.canvasser.update({
    where: { id: c.id },
    data: { passwordHash, active: true, inviteTokenHash: null, inviteExpires: null },
  });
  await createCanvasserSession(c);
  return { ok: true };
}
