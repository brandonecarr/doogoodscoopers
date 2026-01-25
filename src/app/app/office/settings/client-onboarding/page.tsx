"use client";

import { useState } from "react";
import Link from "next/link";
import ServiceAreaSetup from "./ServiceAreaSetup";

type TabId =
  | "service-area"
  | "signup-form"
  | "callout-disclaimers"
  | "thank-you"
  | "emails"
  | "terms"
  | "privacy";

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: "service-area", label: "SERVICE AREA SETUP" },
  { id: "signup-form", label: "SIGNUP FORM" },
  { id: "callout-disclaimers", label: "CALLOUT & DISCLAIMERS" },
  { id: "thank-you", label: "THANK YOU PAGES" },
  { id: "emails", label: "EMAILS" },
  { id: "terms", label: "TERMS OF SERVICE" },
  { id: "privacy", label: "PRIVACY POLICY" },
];

export default function ClientOnboardingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("service-area");

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/app/office/settings" className="text-teal-600 hover:text-teal-700">
              SETTINGS
            </Link>
            <span>/</span>
            <span>CLIENT ONBOARDING</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Client Onboarding</h1>
        </div>

        {/* Dropdown button placeholder */}
        <div className="relative">
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50">
            <span className="text-gray-400">⚙</span>
            CLIENT ONBOARDING
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === "service-area" && <ServiceAreaSetup />}
        {activeTab === "signup-form" && (
          <div className="text-gray-500 text-center py-12">
            Signup Form settings coming soon...
          </div>
        )}
        {activeTab === "callout-disclaimers" && (
          <div className="text-gray-500 text-center py-12">
            Callout & Disclaimers settings coming soon...
          </div>
        )}
        {activeTab === "thank-you" && (
          <div className="text-gray-500 text-center py-12">
            Thank You Pages settings coming soon...
          </div>
        )}
        {activeTab === "emails" && (
          <div className="text-gray-500 text-center py-12">
            Email settings coming soon...
          </div>
        )}
        {activeTab === "terms" && (
          <div className="text-gray-500 text-center py-12">
            Terms of Service editor coming soon...
          </div>
        )}
        {activeTab === "privacy" && (
          <div className="text-gray-500 text-center py-12">
            Privacy Policy editor coming soon...
          </div>
        )}
      </div>
    </div>
  );
}
