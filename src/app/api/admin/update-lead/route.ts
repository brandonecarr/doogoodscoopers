import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { LeadStatus } from "@/types/leads";

interface UpdateLeadData {
  leadId: string;
  leadType: "quote" | "outofarea" | "career" | "commercial" | "adlead";
  status: LeadStatus;
  notes?: string;
}

export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const data: UpdateLeadData = await request.json();
    const { leadId, leadType, status, notes } = data;

    // Validate status
    const validStatuses: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, message: "Invalid status" },
        { status: 400 }
      );
    }

    // Update the appropriate lead type
    switch (leadType) {
      case "quote":
        await prisma.quoteLead.update({
          where: { id: leadId },
          data: { status, notes },
        });
        break;

      case "outofarea":
        await prisma.outOfAreaLead.update({
          where: { id: leadId },
          data: { status, notes },
        });
        break;

      case "career":
        await prisma.careerApplication.update({
          where: { id: leadId },
          data: { status, notes },
        });
        break;

      case "commercial":
        await prisma.commercialLead.update({
          where: { id: leadId },
          data: { status, notes },
        });
        break;

      case "adlead":
        await prisma.adLead.update({
          where: { id: leadId },
          data: { status, notes },
        });
        break;

      default:
        return NextResponse.json(
          { success: false, message: "Invalid lead type" },
          { status: 400 }
        );
    }

    // Map leadType to LeadSource enum value
    const leadTypeMap: Record<string, "QUOTE_FORM" | "OUT_OF_AREA" | "CAREERS" | "COMMERCIAL" | "AD_LEAD"> = {
      quote: "QUOTE_FORM",
      outofarea: "OUT_OF_AREA",
      career: "CAREERS",
      commercial: "COMMERCIAL",
      adlead: "AD_LEAD",
    };

    // Log the activity
    await prisma.activityLog.create({
      data: {
        action: "STATUS_UPDATE",
        leadType: leadTypeMap[leadType],
        leadId: leadId,
        details: { status, notes },
        adminEmail: session.email,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update lead" },
      { status: 500 }
    );
  }
}

// PUT method for full lead updates (editing all fields)
export async function PUT(request: Request) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data = await request.json();

    // Validate required fields
    if (!data.id || !data.firstName || !data.phone || !data.zipCode) {
      return NextResponse.json(
        { error: "ID, first name, phone, and ZIP code are required" },
        { status: 400 }
      );
    }

    // Update the lead with all fields
    const lead = await prisma.quoteLead.update({
      where: { id: data.id },
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
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        action: "LEAD_UPDATED",
        leadType: "QUOTE_FORM",
        leadId: lead.id,
        details: { updatedFields: Object.keys(data) },
        adminEmail: session.email,
      },
    });

    return NextResponse.json({ success: true, id: lead.id });
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}
