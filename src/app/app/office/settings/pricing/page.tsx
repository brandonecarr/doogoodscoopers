"use client";

import { useState } from "react";
import Link from "next/link";
import RegularPremiumPrices from "./RegularPremiumPrices";
import InitialPrices from "./InitialPrices";
import ServicePlans from "./ServicePlans";

type TabId = "regular-premium" | "initial-onetime" | "service-plans";

interface Tab {
  id: TabId;
  label: string;
}

const tabs: Tab[] = [
  { id: "regular-premium", label: "REGULAR AND PREMIUM PRICES" },
  { id: "initial-onetime", label: "INITIAL/ONE TIME PRICES" },
  { id: "service-plans", label: "SERVICE PLANS" },
];

export default function PricingSetupPage() {
  const [activeTab, setActiveTab] = useState<TabId>("regular-premium");

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
            <span>PRICING SETUP</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Setup</h1>
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
        {activeTab === "regular-premium" && <RegularPremiumPrices />}
        {activeTab === "initial-onetime" && <InitialPrices />}
        {activeTab === "service-plans" && <ServicePlans />}
      </div>
    </div>
  );
}
