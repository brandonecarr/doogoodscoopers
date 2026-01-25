"use client";

import Link from "next/link";

interface SettingsCard {
  title: string;
  description: string;
  href: string;
}

const settingsCards: SettingsCard[][] = [
  // Row 1
  [
    {
      title: "Client Onboarding",
      description: "Specify residential service area, new client onboarding settings, email settings and terms of service.",
      href: "/app/office/settings/client-onboarding",
    },
    {
      title: "Billing",
      description: "Manage billing option, interval, sales tax, start of billing cycle, net terms, invoice options and more.",
      href: "/app/office/settings/billing",
    },
  ],
  // Row 2
  [
    {
      title: "Pricing Setup",
      description: "Enter regular and initial/one time cleanup prices. Optionally specify custom prices for one time and initial cleanups.",
      href: "/app/office/settings/pricing",
    },
    {
      title: "Scheduler",
      description: "Create jobs in advance, improve routing within gated communities and update field tech related settings.",
      href: "/app/office/settings/scheduler",
    },
  ],
  // Row 3
  [
    {
      title: "Residential Cross-Sells",
      description: "Specify additional services and products for dog owners. Choose display option during client onboarding.",
      href: "/app/office/settings/residential-cross-sells",
    },
    {
      title: "Commercial Cross-Sells",
      description: "Specify additional services and products for communities. Typical cross-sells include bags and more.",
      href: "/app/office/settings/commercial-cross-sells",
    },
  ],
  // Row 4
  [
    {
      title: "Quickbooks Online",
      description: "Connect to QBO, manage connections, view transaction log and update QBO account type used for deposits.",
      href: "/app/office/settings/quickbooks",
    },
    {
      title: "Payroll",
      description: "Edit staff compensation options per staff member. Basic options include hourly, commission, per yard and fixed pay.",
      href: "/app/office/settings/payroll",
    },
  ],
  // Row 5
  [
    {
      title: "Field Tech App",
      description: "Customize field tech app options including Google directions, notes and photos to clients and data privacy.",
      href: "/app/office/settings/field-tech-app",
    },
    {
      title: "Client Portal",
      description: "Copy client onboarding and client portal links and decide what contact info to display to logged in clients.",
      href: "/app/office/settings/client-portal",
    },
  ],
  // Row 6
  [
    {
      title: "Branding",
      description: "Personalize new and existing client experience with your logo, color and contact information.",
      href: "/app/office/settings/branding",
    },
    {
      title: "Customize Dashboard",
      description: "Manage dashboard widgets, shortcuts and assistance information display. Each staff member can update their own.",
      href: "/app/office/settings/dashboard",
    },
  ],
  // Row 7
  [
    {
      title: "Ratings & Comments/Tipping",
      description: "Let clients rate and tip field techs and choose if field techs may see client ratings & comments.",
      href: "/app/office/settings/ratings-tipping",
    },
    {
      title: "Open API",
      description: "Let your web developer use our API and webhooks to integrate your account with 3rd party applications.",
      href: "/app/office/settings/api",
    },
  ],
  // Row 8
  [
    {
      title: "Directory Listing",
      description: "Manage your gotpooperscooper.com directory listing.",
      href: "/app/office/settings/directory",
    },
    {
      title: "Subscription Details",
      description: "Manage your subscription details, add a different credit card on file and view transaction history.",
      href: "/app/office/settings/subscription",
    },
  ],
];

function SettingsCardComponent({ card }: { card: SettingsCard }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 flex justify-between items-start gap-4">
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{card.description}</p>
      </div>
      <Link
        href={card.href}
        className="text-teal-600 hover:text-teal-700 font-medium text-sm whitespace-nowrap flex-shrink-0"
      >
        VIEW
      </Link>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Settings Cards Grid */}
      <div className="space-y-4">
        {settingsCards.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {row.map((card) => (
              <SettingsCardComponent key={card.href} card={card} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
