"use client";

import { useState, useEffect, useCallback } from "react";
import { Pencil } from "lucide-react";
import PriceEditModal from "./PriceEditModal";

interface PriceMatrix {
  [dogCount: number]: number;
}

interface PricingData {
  regular: PriceMatrix;
  premium: PriceMatrix;
  ruleIds: { [key: string]: string };
}

type ZoneType = "REGULAR" | "PREMIUM";

// Helper to create default prices for a given max dogs
function createDefaultPrices(maxDogs: number): PriceMatrix {
  const prices: PriceMatrix = {};
  for (let i = 1; i <= maxDogs; i++) {
    prices[i] = 0;
  }
  return prices;
}

export default function InitialPrices() {
  const [maxDogs, setMaxDogs] = useState(4);
  const [pricing, setPricing] = useState<PricingData>({
    regular: createDefaultPrices(4),
    premium: createDefaultPrices(4),
    ruleIds: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    zone: ZoneType;
    prices: PriceMatrix;
  } | null>(null);

  const fetchPricing = useCallback(async () => {
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

      // Parse onboarding settings for max dogs
      let settingsMaxDogs = 4;
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        settingsMaxDogs = settingsData.settings?.onboarding?.maxDogs || 4;
      }
      setMaxDogs(settingsMaxDogs);

      const regular: PriceMatrix = createDefaultPrices(settingsMaxDogs);
      const premium: PriceMatrix = createDefaultPrices(settingsMaxDogs);
      const ruleIds: { [key: string]: string } = {};

      for (const rule of rules) {
        // Only process ONETIME frequency
        if (rule.frequency !== "ONETIME") continue;

        const zone = rule.zone || "REGULAR";
        const dogCount = rule.min_dogs || 1;
        const priceCents = rule.base_price_cents || 0;

        const matrix = zone === "PREMIUM" ? premium : regular;
        if (dogCount >= 1 && dogCount <= settingsMaxDogs) {
          matrix[dogCount] = priceCents;
          ruleIds[`${zone}_ONETIME_${dogCount}`] = rule.id;
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
    fetchPricing();
  }, [fetchPricing]);

  const handleEdit = (zone: ZoneType) => {
    const matrix = zone === "PREMIUM" ? pricing.premium : pricing.regular;
    setEditModal({
      isOpen: true,
      zone,
      prices: { ...matrix },
    });
  };

  const handleSave = async (prices: { [dogCount: number]: number }) => {
    if (!editModal) return;

    try {
      const savePromises = Object.entries(prices).map(async ([dogCountStr, priceCents]) => {
        const dogCount = parseInt(dogCountStr);
        const ruleKey = `${editModal.zone}_ONETIME_${dogCount}`;
        const existingId = pricing.ruleIds[ruleKey];

        let response: Response;

        if (existingId) {
          response = await fetch("/api/admin/pricing-rules", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existingId,
              base_price_cents: priceCents,
            }),
          });
        } else {
          response = await fetch("/api/admin/pricing-rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${editModal.zone} - Initial/One-Time - ${dogCount} dog${dogCount > 1 ? "s" : ""}`,
              frequency: "ONETIME",
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

      await fetchPricing();
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

  // Generate array of dog counts from 1 to maxDogs
  const dogCounts = Array.from({ length: maxDogs }, (_, i) => i + 1);

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
      {/* Regular Initial Prices */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Initial/One-Time Cleanup - Regular
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          These prices are for one-time or initial cleanup services in regular zip code areas.
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {dogCounts.map((count) => (
                  <th key={count} className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    {count} dog{count > 1 ? "s" : ""}
                  </th>
                ))}
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                {dogCounts.map((count) => (
                  <td key={count} className="py-3 px-4 text-sm text-gray-900">
                    {formatPrice(pricing.regular[count] || 0)}
                  </td>
                ))}
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleEdit("REGULAR")}
                    className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                  >
                    Edit
                    <Pencil className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Premium Initial Prices */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Initial/One-Time Cleanup - Premium
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          These prices are for one-time or initial cleanup services in premium zip code areas.
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                {dogCounts.map((count) => (
                  <th key={count} className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                    {count} dog{count > 1 ? "s" : ""}
                  </th>
                ))}
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                {dogCounts.map((count) => (
                  <td key={count} className="py-3 px-4 text-sm text-gray-900">
                    {formatPrice(pricing.premium[count] || 0)}
                  </td>
                ))}
                <td className="py-3 px-4">
                  <button
                    onClick={() => handleEdit("PREMIUM")}
                    className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                  >
                    Edit
                    <Pencil className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Modal */}
      {editModal && (
        <PriceEditModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal(null)}
          onSave={handleSave}
          zone={editModal.zone}
          frequency="ONETIME"
          frequencyLabel="Initial/One-Time"
          initialPrices={editModal.prices}
          maxDogs={maxDogs}
        />
      )}
    </div>
  );
}
