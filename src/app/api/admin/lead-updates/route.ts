import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

interface CreateUpdateData {
  leadId: string;
  leadType: "quote" | "outofarea" | "career" | "commercial" | "adlead";
  message: string;
  communicationType: string;
}

const leadTypeMap: Record<string, "QUOTE_FORM" | "OUT_OF_AREA" | "CAREERS" | "COMMERCIAL" | "AD_LEAD"> = {
  quote: "QUOTE_FORM",
  outofarea: "OUT_OF_AREA",
  career: "CAREERS",
  commercial: "COMMERCIAL",
  adlead: "AD_LEAD",
};

const validCommunicationTypes = ["phone_call", "text_message", "email", "in_person", "other"];

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const data: CreateUpdateData = await request.json();

    if (!data.leadId || !data.leadType || !data.message || !data.communicationType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!validCommunicationTypes.includes(data.communicationType)) {
      return NextResponse.json(
        { error: "Invalid communication type" },
        { status: 400 }
      );
    }

    const mappedLeadType = leadTypeMap[data.leadType];
    if (!mappedLeadType) {
      return NextResponse.json(
        { error: "Invalid lead type" },
        { status: 400 }
      );
    }

    const update = await prisma.leadUpdate.create({
      data: {
        leadId: data.leadId,
        leadType: mappedLeadType,
        message: data.message,
        communicationType: data.communicationType,
        adminEmail: session.email,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        action: "UPDATE_ADDED",
        leadType: mappedLeadType,
        leadId: data.leadId,
        details: { communicationType: data.communicationType },
        adminEmail: session.email,
      },
    });

    return NextResponse.json({ success: true, id: update.id });
  } catch (error) {
    console.error("Error creating lead update:", error);
    return NextResponse.json(
      { error: "Failed to create update" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId");
    const leadType = searchParams.get("leadType");

    if (!leadId || !leadType) {
      return NextResponse.json(
        { error: "Missing leadId or leadType" },
        { status: 400 }
      );
    }

    const mappedLeadType = leadTypeMap[leadType];
    if (!mappedLeadType) {
      return NextResponse.json(
        { error: "Invalid lead type" },
        { status: 400 }
      );
    }

    const updates = await prisma.leadUpdate.findMany({
      where: {
        leadId,
        leadType: mappedLeadType,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ updates });
  } catch (error) {
    console.error("Error fetching lead updates:", error);
    return NextResponse.json(
      { error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}
