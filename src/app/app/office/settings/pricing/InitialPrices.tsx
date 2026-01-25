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

export default function InitialPrices() {
  const [pricing, setPricing] = useState<PricingData>({
    regular: { 1: 0, 2: 0, 3: 0, 4: 0 },
    premium: { 1: 0, 2: 0, 3: 0, 4: 0 },
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
      const response = await fetch("/api/admin/pricing-rules");
      if (!response.ok) {
        throw new Error("Failed to fetch pricing rules");
      }
      const data = await response.json();
      const rules = data.rules || [];

      const regular: PriceMatrix = { 1: 0, 2: 0, 3: 0, 4: 0 };
      const premium: PriceMatrix = { 1: 0, 2: 0, 3: 0, 4: 0 };
      const ruleIds: { [key: string]: string } = {};

      for (const rule of rules) {
        // Only process ONETIME frequency
        if (rule.frequency !== "ONETIME") continue;

        const zone = rule.zone || "REGULAR";
        const dogCount = rule.min_dogs || 1;
        const priceCents = rule.base_price_cents || 0;

        const matrix = zone === "PREMIUM" ? premium : regular;
        if (dogCount >= 1 && dogCount <= 4) {
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
      for (const [dogCountStr, priceCents] of Object.entries(prices)) {
        const dogCount = parseInt(dogCountStr);
        const ruleKey = `${editModal.zone}_ONETIME_${dogCount}`;
        const existingId = pricing.ruleIds[ruleKey];

        if (existingId) {
          await fetch("/api/admin/pricing-rules", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: existingId,
              base_price_cents: priceCents,
            }),
          });
        } else {
          await fetch("/api/admin/pricing-rules", {
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
      }

      await fetchPricing();
      setEditModal(null);
    } catch (err) {
      console.error("Error saving prices:", err);
      setError("Failed to save prices");
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
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
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">1 dog</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">2 dogs</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">3 dogs</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">4 dogs</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(pricing.regular[1] || 0)}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(pricing.regular[2] || 0)}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(pricing.regular[3] || 0)}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(pricing.regular[4] || 0)}</td>
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
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">1 dog</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">2 dogs</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">3 dogs</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">4 dogs</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(pricing.premium[1] || 0)}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(pricing.premium[2] || 0)}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(pricing.premium[3] || 0)}</td>
                <td className="py-3 px-4 text-sm text-gray-900">{formatPrice(pricing.premium[4] || 0)}</td>
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
        />
      )}
    </div>
  );
}
