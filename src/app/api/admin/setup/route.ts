import { NextRequest, NextResponse } from "next/server";
import { createAdminUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

// This endpoint is for initial setup only
// In production, you should disable this after creating your admin user

// GET handler for easy browser-based setup
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");
    const password = searchParams.get("password");
    const name = searchParams.get("name");

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required. Use: /api/admin/setup?email=you@example.com&password=yourpassword" },
        { status: 400 }
      );
    }

    // Check if any admin users already exist
    const existingAdmins = await prisma.adminUser.count();

    if (existingAdmins > 0) {
      return NextResponse.json(
        { success: false, error: "Admin user already exists. This endpoint is disabled." },
        { status: 403 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const result = await createAdminUser(email, password, name || undefined);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin user created successfully. You can now log in at /admin/login",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred during setup" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Check if any admin users already exist
    const existingAdmins = await prisma.adminUser.count();

    if (existingAdmins > 0) {
      return NextResponse.json(
        { success: false, error: "Admin user already exists. This endpoint is disabled." },
        { status: 403 }
      );
    }

    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const result = await createAdminUser(email, password, name);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Admin user created successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred during setup" },
      { status: 500 }
    );
  }
}
