import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface CareerApplication {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  dateOfBirth: string;
  driversLicense: string;
  ssnLast4: string;
  legalCitizen: string;
  hasAutoInsurance: string;
  convictedFelony: string;
  references: string;
  currentEmployment: string;
  workDuties: string;
  whyLeftPrevious: string;
  mayContactEmployers: string;
  previousBossContact: string;
  whyWorkHere: string;
}

export async function POST(request: Request) {
  try {
    const data: CareerApplication = await request.json();

    // Store in database
    try {
      await prisma.careerApplication.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          dateOfBirth: data.dateOfBirth,
          driversLicense: data.driversLicense,
          ssnLast4: data.ssnLast4,
          legalCitizen: data.legalCitizen === "yes",
          hasAutoInsurance: data.hasAutoInsurance === "yes",
          convictedFelony: data.convictedFelony === "yes",
          references: data.references,
          currentEmployment: data.currentEmployment,
          workDuties: data.workDuties,
          whyLeftPrevious: data.whyLeftPrevious,
          mayContactEmployers: data.mayContactEmployers === "yes",
          previousBossContact: data.previousBossContact,
          whyWorkHere: data.whyWorkHere,
        },
      });
    } catch (dbError) {
      console.error("Database error storing career application:", dbError);
      // Continue even if DB fails - we still want to send the email
    }

    // Validate required fields
    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "address",
      "city",
      "dateOfBirth",
      "driversLicense",
      "ssnLast4",
      "legalCitizen",
      "hasAutoInsurance",
      "convictedFelony",
      "references",
      "currentEmployment",
      "workDuties",
      "whyLeftPrevious",
      "mayContactEmployers",
      "previousBossContact",
      "whyWorkHere",
    ];

    for (const field of requiredFields) {
      if (!data[field as keyof CareerApplication]) {
        return NextResponse.json(
          { success: false, message: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Send notification email via webhook
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      const emailContent = `
New Career Application Received!

PERSONAL INFORMATION
--------------------
Name: ${data.firstName} ${data.lastName}
Email: ${data.email}
Phone: ${data.phone}
Address: ${data.address}, ${data.city}
Date of Birth: ${data.dateOfBirth}
Driver's License: ${data.driversLicense}
Last 4 SSN: ${data.ssnLast4}

EMPLOYMENT ELIGIBILITY
----------------------
Legal US Citizen: ${data.legalCitizen}
Has Auto Insurance: ${data.hasAutoInsurance}
Convicted of Felony: ${data.convictedFelony}

WORK HISTORY
------------
Current Employment: ${data.currentEmployment}
Work Duties: ${data.workDuties}
Why Left Previous Job: ${data.whyLeftPrevious}
May Contact Employers: ${data.mayContactEmployers}
Previous Boss Contact: ${data.previousBossContact}

References:
${data.references}

WHY THEY WANT TO WORK HERE
--------------------------
${data.whyWorkHere}
      `.trim();

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: process.env.NOTIFICATION_EMAIL || "service@doogoodscoopers.com",
          subject: `New Career Application: ${data.firstName} ${data.lastName}`,
          text: emailContent,
        }),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Application submitted successfully",
    });
  } catch (error) {
    console.error("Career application error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit application" },
      { status: 500 }
    );
  }
}
