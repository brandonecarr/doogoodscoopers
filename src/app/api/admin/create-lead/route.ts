import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";

interface CreateLeadData {
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  address?: string;
  city?: string;
  zipCode: string;
  numberOfDogs?: string;
  frequency?: string;
  lastCleaned?: string;
  gateLocation?: string;
  gateCode?: string;
  status?: LeadStatus;
  notes?: string;
  dogsInfo?: unknown;
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data: CreateLeadData = await request.json();

    // Validate required fields
    if (!data.firstName || !data.phone || !data.zipCode) {
      return NextResponse.json(
        { error: "First name, phone, and ZIP code are required" },
        { status: 400 }
      );
    }

    // Create the lead
    const lead = await prisma.quoteLead.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone,
        address: data.address || null,
        city: data.city || null,
        zipCode: data.zipCode,
        numberOfDogs: data.numberOfDogs || null,
        frequency: data.frequency || null,
        lastCleaned: data.lastCleaned || null,
        gateLocation: data.gateLocation || null,
        gateCode: data.gateCode || null,
        status: data.status || "NEW",
        notes: data.notes || null,
        dogsInfo: data.dogsInfo || undefined,
        lastStep: "Manual Entry",
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        action: "LEAD_CREATED",
        leadType: "QUOTE_FORM",
        leadId: lead.id,
        details: { createdManually: true },
        adminEmail: session.email,
      },
    });

    return NextResponse.json({ success: true, id: lead.id });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
