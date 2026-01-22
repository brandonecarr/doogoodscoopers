import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import prisma from "./prisma";

const SESSION_COOKIE = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Hash a password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify a password against its hash
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create a simple session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

// Store session in a cookie (simple approach - in production, use JWT or session store)
export async function createSession(email: string): Promise<string> {
  const token = generateSessionToken();

  // Store session token with email in cookie
  // In a real app, you'd store this in a database or Redis
  const sessionData = JSON.stringify({ email, token, createdAt: Date.now() });
  const encoded = Buffer.from(sessionData).toString("base64");

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return token;
}

// Get current session
export async function getSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const decoded = Buffer.from(sessionCookie.value, "base64").toString("utf8");
    const session = JSON.parse(decoded);

    // Check if session is expired (7 days)
    if (Date.now() - session.createdAt > SESSION_MAX_AGE * 1000) {
      await destroySession();
      return null;
    }

    // Verify user still exists
    const user = await prisma.adminUser.findUnique({
      where: { email: session.email },
    });

    if (!user) {
      await destroySession();
      return null;
    }

    return { email: session.email };
  } catch {
    return null;
  }
}

// Destroy session (logout)
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Middleware helper to check if user is authenticated
export async function requireAuth(): Promise<{ email: string }> {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  return session;
}

// Login function
export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return { success: false, error: "Invalid email or password" };
  }

  await createSession(user.email);

  return { success: true };
}

// Logout function
export async function logout(): Promise<void> {
  await destroySession();
}

// Create initial admin user (for setup)
export async function createAdminUser(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  const existing = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existing) {
    return { success: false, error: "User already exists" };
  }

  const passwordHash = await hashPassword(password);

  await prisma.adminUser.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      name,
    },
  });

  return { success: true };
}
