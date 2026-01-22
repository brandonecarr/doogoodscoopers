import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface CommercialLeadData {
  name: string;
  propertyName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;
  notes?: string;
}

export async function POST(request: Request) {
  try {
    const data: CommercialLeadData = await request.json();

    // Validate required fields
    const requiredFields = ["name", "propertyName", "phone", "email", "city", "state", "zipCode"];
    for (const field of requiredFields) {
      if (!data[field as keyof CommercialLeadData]) {
        return NextResponse.json(
          { success: false, message: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Store in database
    const lead = await prisma.commercialLead.create({
      data: {
        contactName: data.name,
        propertyName: data.propertyName,
        email: data.email,
        phone: data.phone,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        inquiry: data.notes || null,
      },
    });

    // Send notification email via webhook (if configured)
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      const emailContent = `
New Commercial Service Inquiry!

CONTACT INFORMATION
-------------------
Name: ${data.name}
Property: ${data.propertyName}
Email: ${data.email}
Phone: ${data.phone}

LOCATION
--------
City: ${data.city}
State: ${data.state}
ZIP: ${data.zipCode}

${data.notes ? `ADDITIONAL NOTES\n----------------\n${data.notes}` : ""}
      `.trim();

      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: process.env.NOTIFICATION_EMAIL || "service@doogoodscoopers.com",
            subject: `New Commercial Inquiry: ${data.propertyName}`,
            text: emailContent,
          }),
        });
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "Your inquiry has been submitted. We'll be in touch soon!",
      leadId: lead.id,
    });
  } catch (error) {
    console.error("Commercial lead submission error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit inquiry. Please try again." },
      { status: 500 }
    );
  }
}
