import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncContactToQuo } from "@/lib/quo";
import { findProspectLeadsByPhone, consolidateByPhone } from "@/lib/lead-duplicates";

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

    // One person = one lead. Reuse the earliest existing Quote for this phone
    // (any zip) and overwrite it with the fresh quote answers; otherwise create
    // one. Then consolidate any other prospect leads (e.g. an earlier Ad Lead
    // that this same person came in through) into the surviving Quote.
    const prospects = await findProspectLeadsByPhone(data.phone);
    const existingQuote = prospects
      .filter((p) => p.type === "quote")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

    const quoteFields = {
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
    };

    let leadId: string;
    let message: string;
    if (existingQuote) {
      await prisma.quoteLead.update({ where: { id: existingQuote.id }, data: quoteFields });
      leadId = existingQuote.id;
      message = "Lead updated";
    } else {
      const lead = await prisma.quoteLead.create({
        data: { ...quoteFields, phone: data.phone, zipCode: data.zipCode },
      });
      leadId = lead.id;
      message = "Lead saved";
    }

    // Fold any Ad Lead / extra Quote for the same phone into one surviving lead
    // (a Quote always wins). Never fails the submission if consolidation errors.
    if (prospects.length > (existingQuote ? 1 : 0)) {
      try {
        const survivor = await consolidateByPhone(data.phone);
        if (survivor) leadId = survivor.id;
      } catch (e) {
        console.error("[save-quote-lead] consolidation failed:", e);
      }
    }

    syncContactToQuo({
      externalId: `quotelead:${leadId}`,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      source: "DooGoodScoopers Quote",
    });

    return NextResponse.json({ success: true, message, leadId });
  } catch (error) {
    console.error("Error saving quote lead:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save lead" },
      { status: 500 }
    );
  }
}
