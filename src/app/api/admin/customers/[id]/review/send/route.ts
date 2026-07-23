import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendSms, isQuoConfigured } from "@/lib/quo";
import { renderTemplate } from "@/lib/resend";
import { isOptedOut } from "@/lib/sms-optout";

// Default review-request text. Editable via AppSetting "reviews.requestMessage";
// {{firstName}} and {{reviewLink}} are filled in.
const DEFAULT_MESSAGE =
  "Hi {{firstName}}, thanks for being a DooGoodScoopers customer! 🐾 If you have a sec, a quick Google review would really help our small business: {{reviewLink}}";

// POST → send a one-off review-request text to this customer, log it, and mark
// their review status Request Sent.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await prisma.sweepandgoCustomer.findUnique({ where: { id } });
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const phone = customer.cellPhone || customer.homePhone;
  if (!phone) return NextResponse.json({ error: "This customer has no phone number." }, { status: 400 });
  if (!isQuoConfigured()) return NextResponse.json({ error: "Texting isn't configured yet." }, { status: 400 });
  if (await isOptedOut(phone)) {
    return NextResponse.json({ error: "This customer replied STOP and can no longer be texted.", optedOut: true }, { status: 409 });
  }

  const [linkRow, msgRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "reviews.google.writeUrl" } }),
    prisma.appSetting.findUnique({ where: { key: "reviews.requestMessage" } }),
  ]);
  const reviewLink = linkRow?.value?.trim();
  if (!reviewLink) {
    return NextResponse.json(
      { error: 'Set your Google "leave a review" link in the Reviews section first.' },
      { status: 400 }
    );
  }

  const template = msgRow?.value?.trim() || DEFAULT_MESSAGE;
  const body = renderTemplate(template, {
    firstName: customer.firstName || "there",
    name: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "there",
    reviewLink,
  });

  const result = await sendSms({ to: phone, body });

  await prisma.leadMessage.create({
    data: {
      leadType: "CUSTOMER",
      leadId: id,
      direction: "OUTBOUND",
      body,
      phone,
      provider: "quo",
      quoMessageId: result.messageId ?? null,
      status: result.success ? result.status || "SENT" : "FAILED",
      adminEmail: session.email,
    },
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error || "Failed to send." }, { status: 502 });
  }

  // Track the request + reflect it on the customer's review status.
  await prisma.review
    .upsert({
      where: { externalId: `reviewreq:${id}` },
      create: {
        externalId: `reviewreq:${id}`,
        customerName: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Customer",
        phone,
        sngCustomerId: id,
        platform: "google",
        status: "REQUESTED",
        requestChannel: "sms",
        requestedAt: new Date(),
      },
      update: { requestedAt: new Date(), requestChannel: "sms" },
    })
    .catch((e) => console.error("[review/send] review upsert failed", e));

  // A manual send is an explicit "ask" — set Request Sent unless they've already
  // completed a review (don't downgrade that).
  await prisma.sweepandgoCustomer.updateMany({
    where: { id, NOT: { reviewStatus: "REVIEW_COMPLETE" } },
    data: { reviewStatus: "REQUEST_SENT" },
  });

  return NextResponse.json({ success: true, reviewStatus: customer.reviewStatus === "REVIEW_COMPLETE" ? "REVIEW_COMPLETE" : "REQUEST_SENT" });
}
