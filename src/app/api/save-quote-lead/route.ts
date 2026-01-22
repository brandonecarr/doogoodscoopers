import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface QuoteLeadData {
  // Contact info
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;

  // Address
  address?: string;
  city?: string;
  zipCode: string;

  // Service details
  numberOfDogs?: string;
  frequency?: string;
  lastCleaned?: string;

  // Gate info
  gateLocation?: string;
  gateCode?: string;

  // Step tracking
  lastStep: string;

  // Dogs info (JSON array)
  dogsInfo?: Array<{
    name: string;
    breed?: string;
    isSafe: boolean;
    comments?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const data: QuoteLeadData = await request.json();

    // Validate required fields
    if (!data.firstName || !data.phone || !data.zipCode) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if we already have a lead with this phone/zip combination
    // If so, update it instead of creating a new one
    const existingLead = await prisma.quoteLead.findFirst({
      where: {
        phone: data.phone,
        zipCode: data.zipCode,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingLead) {
      // Update existing lead with new data
      await prisma.quoteLead.update({
        where: { id: existingLead.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          address: data.address,
          city: data.city,
          numberOfDogs: data.numberOfDogs,
          frequency: data.frequency,
          lastCleaned: data.lastCleaned,
          gateLocation: data.gateLocation,
          gateCode: data.gateCode,
          lastStep: data.lastStep,
          dogsInfo: data.dogsInfo ? JSON.parse(JSON.stringify(data.dogsInfo)) : undefined,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Lead updated",
        leadId: existingLead.id,
      });
    }

    // Create new lead
    const lead = await prisma.quoteLead.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        zipCode: data.zipCode,
        numberOfDogs: data.numberOfDogs,
        frequency: data.frequency,
        lastCleaned: data.lastCleaned,
        gateLocation: data.gateLocation,
        gateCode: data.gateCode,
        lastStep: data.lastStep,
        dogsInfo: data.dogsInfo ? JSON.parse(JSON.stringify(data.dogsInfo)) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Lead saved",
      leadId: lead.id,
    });
  } catch (error) {
    console.error("Error saving quote lead:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save lead" },
      { status: 500 }
    );
  }
}
