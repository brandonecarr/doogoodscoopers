"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Pencil, ChevronDown } from "lucide-react";
import PriceEditModal from "./PriceEditModal";

// All possible frequencies with mapping from onboarding settings to pricing keys
// Ordered from most frequent to least frequent
const allFrequencies = [
  { key: "SEVEN_TIMES_A_WEEK", label: "Seven Times A Week", onboardingKey: "SEVEN_TIMES_A_WEEK" },
  { key: "SIX_TIMES_A_WEEK", label: "Six Times A Week", onboardingKey: "SIX_TIMES_A_WEEK" },
  { key: "FIVE_TIMES_A_WEEK", label: "Five Times A Week", onboardingKey: "FIVE_TIMES_A_WEEK" },
  { key: "FOUR_TIMES_A_WEEK", label: "Four Times A Week", onboardingKey: "FOUR_TIMES_A_WEEK" },
  { key: "THREE_TIMES_A_WEEK", label: "Three Times A Week", onboardingKey: "THREE_TIMES_A_WEEK" },
  { key: "TWICE_WEEKLY", label: "Two Times A Week", onboardingKey: "TWO_TIMES_A_WEEK" },
  { key: "WEEKLY", label: "Once A Week", onboardingKey: "ONCE_A_WEEK" },
  { key: "BIWEEKLY", label: "Bi Weekly", onboardingKey: "BI_WEEKLY" },
  { key: "TWICE_PER_MONTH", label: "Twice Per Month", onboardingKey: "TWICE_PER_MONTH" },
  { key: "EVERY_THREE_WEEKS", label: "Every Three Weeks", onboardingKey: "EVERY_THREE_WEEKS" },
  { key: "EVERY_FOUR_WEEKS", label: "Every Four Weeks", onboardingKey: "EVERY_FOUR_WEEKS" },
  { key: "MONTHLY", label: "Once A Month", onboardingKey: "ONCE_A_MONTH" },
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

// Helper to create default prices for a given max dogs
function createDefaultPrices(maxDogs: number): { [dogCount: number]: number } {
  const prices: { [dogCount: number]: number } = {};
  for (let i = 1; i <= maxDogs; i++) {
    prices[i] = 0;
  }
  return prices;
}

// Build default price matrix from all frequencies
function buildDefaultPriceMatrix(maxDogs: number): PriceMatrix {
  return Object.fromEntries(
    allFrequencies.map((f) => [f.key, createDefaultPrices(maxDogs)])
  );
}

export default function RegularPremiumPrices() {
  const [maxDogs, setMaxDogs] = useState(4);
  const [pricing, setPricing] = useState<PricingData>({
    regular: buildDefaultPriceMatrix(4),
    premium: buildDefaultPriceMatrix(4),
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

      // Parse onboarding settings for enabled frequencies and max dogs
      let cleanupFrequencies: string[] = [];
      let settingsMaxDogs = 4;
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        cleanupFrequencies = settingsData.settings?.onboarding?.cleanupFrequencies || [];
        settingsMaxDogs = settingsData.settings?.onboarding?.maxDogs || 4;
      }
      setEnabledFrequencies(cleanupFrequencies);
      setMaxDogs(settingsMaxDogs);

      // Organize rules into price matrices - dynamically create from all frequencies
      const frequencyKeys = allFrequencies.map((f) => f.key);
      const regular: PriceMatrix = Object.fromEntries(
        frequencyKeys.map((k) => [k, createDefaultPrices(settingsMaxDogs)])
      );
      const premium: PriceMatrix = Object.fromEntries(
        frequencyKeys.map((k) => [k, createDefaultPrices(settingsMaxDogs)])
      );
      const ruleIds: { [key: string]: string } = {};

      for (const rule of rules) {
        const zone = rule.zone || "REGULAR";
        const frequency = rule.frequency;
        const dogCount = rule.min_dogs || 1;
        const priceCents = rule.base_price_cents || 0;

        // Skip ONETIME - that's handled in InitialPrices tab
        if (frequency === "ONETIME") {
          continue;
        }

        const matrix = zone === "PREMIUM" ? premium : regular;
        if (matrix[frequency] && dogCount >= 1 && dogCount <= settingsMaxDogs) {
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
      const savePromises = Object.entries(prices).map(async ([dogCountStr, priceCents]) => {
        const dogCount = parseInt(dogCountStr);
        const ruleKey = `${editModal.zone}_${editModal.frequency}_${dogCount}`;
        const existingId = pricing.ruleIds[ruleKey];

        let response: Response;

        if (existingId) {
          // Update existing rule
          response = await fetch("/api/admin/pricing-rules", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existingId,
              base_price_cents: priceCents,
            }),
          });
        } else {
          // Create new rule
          response = await fetch("/api/admin/pricing-rules", {
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

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Failed to save price for ${dogCount} dog(s):`, errorData);
          throw new Error(errorData.error || `Failed to save price for ${dogCount} dog(s)`);
        }

        return response.json();
      });

      // Wait for all saves to complete
      await Promise.all(savePromises);

      // Refresh data
      await fetchData();
      setEditModal(null);
    } catch (err) {
      console.error("Error saving prices:", err);
      // Re-throw so modal can display the error
      throw err;
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
        maxDogs={maxDogs}
        onEdit={handleEdit}
        formatPrice={formatPrice}
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
        maxDogs={maxDogs}
        onEdit={handleEdit}
        formatPrice={formatPrice}
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
          maxDogs={maxDogs}
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
  maxDogs: number;
  onEdit: (zone: ZoneType, frequency: FrequencyKey) => void;
  formatPrice: (cents: number) => string;
}

function PricingTable({
  title,
  description,
  matrix,
  zone,
  frequencies,
  maxDogs,
  onEdit,
  formatPrice,
}: PricingTableProps) {
  // Generate array of dog counts from 1 to maxDogs
  const dogCounts = Array.from({ length: maxDogs }, (_, i) => i + 1);

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
              {dogCounts.map((count) => (
                <th key={count} className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  {count} dog{count > 1 ? "s" : ""}
                </th>
              ))}
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {frequencies.map((freq) => (
              <tr key={freq.key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900">{freq.label}</td>
                {dogCounts.map((count) => (
                  <td key={count} className="py-3 px-4 text-sm text-gray-900">
                    {formatPrice(matrix[freq.key]?.[count] || 0)}
                  </td>
                ))}
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
