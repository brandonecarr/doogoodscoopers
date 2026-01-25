"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Pencil, ChevronDown } from "lucide-react";
import PriceEditModal from "./PriceEditModal";

// All possible frequencies with mapping from onboarding settings to pricing keys
const allFrequencies = [
  { key: "TWICE_WEEKLY", label: "Two Times A Week", onboardingKey: "TWO_TIMES_A_WEEK" },
  { key: "WEEKLY", label: "Once A Week", onboardingKey: "ONCE_A_WEEK" },
  { key: "BIWEEKLY", label: "Bi Weekly", onboardingKey: "BI_WEEKLY" },
] as const;

type FrequencyKey = (typeof allFrequencies)[number]["key"];
type ZoneType = "REGULAR" | "PREMIUM";

// Price matrix structure: { frequency: { dogCount: priceCents } }
interface PriceMatrix {
  [frequency: string]: {
    [dogCount: number]: number;
  };
}

interface PricingData {
  regular: PriceMatrix;
  premium: PriceMatrix;
  ruleIds: { [key: string]: string }; // Map of "zone_frequency_dogs" to rule ID
}

const defaultPriceMatrix: PriceMatrix = {
  TWICE_WEEKLY: { 1: 0, 2: 0, 3: 0, 4: 0 },
  WEEKLY: { 1: 0, 2: 0, 3: 0, 4: 0 },
  BIWEEKLY: { 1: 0, 2: 0, 3: 0, 4: 0 },
};

export default function RegularPremiumPrices() {
  const [pricing, setPricing] = useState<PricingData>({
    regular: { ...defaultPriceMatrix },
    premium: { ...defaultPriceMatrix },
    ruleIds: {},
  });
  const [enabledFrequencies, setEnabledFrequencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    zone: ZoneType;
    frequency: FrequencyKey;
    prices: { [dogCount: number]: number };
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch both pricing rules and onboarding settings in parallel
      const [pricingResponse, settingsResponse] = await Promise.all([
        fetch("/api/admin/pricing-rules"),
        fetch("/api/admin/onboarding-settings"),
      ]);

      if (!pricingResponse.ok) {
        throw new Error("Failed to fetch pricing rules");
      }

      const pricingData = await pricingResponse.json();
      const rules = pricingData.rules || [];

      // Parse onboarding settings for enabled frequencies
      let cleanupFrequencies: string[] = [];
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        cleanupFrequencies = settingsData.settings?.onboarding?.cleanupFrequencies || [];
      }
      setEnabledFrequencies(cleanupFrequencies);

      // Organize rules into price matrices
      const regular: PriceMatrix = {
        TWICE_WEEKLY: { 1: 0, 2: 0, 3: 0, 4: 0 },
        WEEKLY: { 1: 0, 2: 0, 3: 0, 4: 0 },
        BIWEEKLY: { 1: 0, 2: 0, 3: 0, 4: 0 },
      };
      const premium: PriceMatrix = {
        TWICE_WEEKLY: { 1: 0, 2: 0, 3: 0, 4: 0 },
        WEEKLY: { 1: 0, 2: 0, 3: 0, 4: 0 },
        BIWEEKLY: { 1: 0, 2: 0, 3: 0, 4: 0 },
      };
      const ruleIds: { [key: string]: string } = {};

      for (const rule of rules) {
        const zone = rule.zone || "REGULAR";
        const frequency = rule.frequency;
        const dogCount = rule.min_dogs || 1;
        const priceCents = rule.base_price_cents || 0;

        // Only process recurring frequencies
        if (!["WEEKLY", "BIWEEKLY", "TWICE_WEEKLY"].includes(frequency)) {
          continue;
        }

        const matrix = zone === "PREMIUM" ? premium : regular;
        if (matrix[frequency] && dogCount >= 1 && dogCount <= 4) {
          matrix[frequency][dogCount] = priceCents;
          ruleIds[`${zone}_${frequency}_${dogCount}`] = rule.id;
        }
      }

      setPricing({ regular, premium, ruleIds });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter frequencies based on what's enabled in onboarding settings
  const activeFrequencies = allFrequencies.filter((freq) =>
    enabledFrequencies.includes(freq.onboardingKey)
  );

  const handleEdit = (zone: ZoneType, frequency: FrequencyKey) => {
    const matrix = zone === "PREMIUM" ? pricing.premium : pricing.regular;
    setEditModal({
      isOpen: true,
      zone,
      frequency,
      prices: { ...matrix[frequency] },
    });
  };

  const handleSave = async (prices: { [dogCount: number]: number }) => {
    if (!editModal) return;

    try {
      // Save each dog count as a separate rule
      for (const [dogCountStr, priceCents] of Object.entries(prices)) {
        const dogCount = parseInt(dogCountStr);
        const ruleKey = `${editModal.zone}_${editModal.frequency}_${dogCount}`;
        const existingId = pricing.ruleIds[ruleKey];

        if (existingId) {
          // Update existing rule
          await fetch("/api/admin/pricing-rules", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existingId,
              base_price_cents: priceCents,
            }),
          });
        } else {
          // Create new rule
          await fetch("/api/admin/pricing-rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${editModal.zone} - ${editModal.frequency} - ${dogCount} dog${dogCount > 1 ? "s" : ""}`,
              frequency: editModal.frequency,
              zone: editModal.zone,
              min_dogs: dogCount,
              max_dogs: dogCount,
              base_price_cents: priceCents,
              is_active: true,
            }),
          });
        }
      }

      // Refresh data
      await fetchData();
      setEditModal(null);
    } catch (err) {
      console.error("Error saving prices:", err);
      setError("Failed to save prices");
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getFrequencyLabel = (key: FrequencyKey) => {
    return allFrequencies.find((f) => f.key === key)?.label || key;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Advanced Pricing Setup dropdown - placeholder for future */}
      <div className="flex justify-end">
        <button className="inline-flex items-center gap-2 px-4 py-2 text-teal-600 hover:text-teal-700 font-medium text-sm border border-teal-600 rounded-md hover:bg-teal-50">
          Advanced Pricing Setup
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Regular Prices */}
      <PricingTable
        title="Prepaid Fixed Monthly - Regular"
        description="Please enter your fixed cost prepaid prices. Regular pricing affects clients living in regular zip codes. If you do not offer certain options (example: once a month), you should skip updating those prices."
        matrix={pricing.regular}
        zone="REGULAR"
        frequencies={activeFrequencies}
        onEdit={handleEdit}
        formatPrice={formatPrice}
        getFrequencyLabel={getFrequencyLabel}
      />

      {/* Manage frequencies link */}
      <div className="text-sm">
        <Link
          href="/app/office/settings/client-onboarding?tab=signup-form"
          className="text-teal-600 hover:text-teal-700 underline"
        >
          Manage cleanup frequencies within Client Onboarding &gt; Signup Form
        </Link>
      </div>

      {/* Premium Prices */}
      <PricingTable
        title="Prepaid Fixed Monthly - Premium"
        description="Please enter your fixed cost prepaid prices. Premium pricing affects clients living in premium zip codes. If you do not offer certain options (example: once a month), you should skip updating those prices."
        matrix={pricing.premium}
        zone="PREMIUM"
        frequencies={activeFrequencies}
        onEdit={handleEdit}
        formatPrice={formatPrice}
        getFrequencyLabel={getFrequencyLabel}
      />

      {/* Edit Modal */}
      {editModal && (
        <PriceEditModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal(null)}
          onSave={handleSave}
          zone={editModal.zone}
          frequency={editModal.frequency}
          frequencyLabel={getFrequencyLabel(editModal.frequency)}
          initialPrices={editModal.prices}
        />
      )}
    </div>
  );
}

interface FrequencyItem {
  key: FrequencyKey;
  label: string;
  onboardingKey: string;
}

interface PricingTableProps {
  title: string;
  description: string;
  matrix: PriceMatrix;
  zone: ZoneType;
  frequencies: readonly FrequencyItem[];
  onEdit: (zone: ZoneType, frequency: FrequencyKey) => void;
  formatPrice: (cents: number) => string;
  getFrequencyLabel: (key: FrequencyKey) => string;
}

function PricingTable({
  title,
  description,
  matrix,
  zone,
  frequencies,
  onEdit,
  formatPrice,
}: PricingTableProps) {
  if (frequencies.length === 0) {
    return (
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-4">{description}</p>
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500">
            No cleanup frequencies are enabled. Enable frequencies in Client Onboarding settings.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 w-48"></th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">1 dog</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">2 dogs</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">3 dogs</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">4 dogs</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {frequencies.map((freq) => (
              <tr key={freq.key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900">{freq.label}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(matrix[freq.key]?.[1] || 0)}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(matrix[freq.key]?.[2] || 0)}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(matrix[freq.key]?.[3] || 0)}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(matrix[freq.key]?.[4] || 0)}</td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => onEdit(zone, freq.key)}
                    className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                  >
                    Edit
                    <Pencil className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
