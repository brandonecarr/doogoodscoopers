"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, X } from "lucide-react";

interface CrossSell {
  id: string;
  name: string;
  description: string;
  unit: string;
  pricePerUnit: number; // in cents
  type: "SERVICE" | "PRODUCT";
  taxable: boolean;
}

interface Client {
  id: string;
  name: string;
}

export default function CrossSellDetailPage() {
  const params = useParams();
  const router = useRouter();
  const crossSellId = params.id as string;

  const [crossSell, setCrossSell] = useState<CrossSell | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/onboarding-settings");
      if (response.ok) {
        const data = await response.json();
        const crossSellsSettings = data.settings?.residentialCrossSells || {};
        const items = crossSellsSettings.items || [];
        const foundCrossSell = items.find((item: CrossSell) => item.id === crossSellId);

        if (foundCrossSell) {
          setCrossSell(foundCrossSell);
        } else {
          setError("Cross-sell not found");
        }
      }

      // Fetch clients who use this cross-sell
      // For now, this will be empty since we don't have the client-crosssell relationship yet
      // In a real implementation, you would fetch from /api/admin/cross-sells/{id}/clients
      setClients([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [crossSellId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveCrossSell = async (updatedCrossSell: CrossSell) => {
    try {
      // Fetch current settings
      const response = await fetch("/api/admin/onboarding-settings");
      if (!response.ok) throw new Error("Failed to fetch settings");

      const data = await response.json();
      const crossSellsSettings = data.settings?.residentialCrossSells || {};
      const items = crossSellsSettings.items || [];

      // Update the cross-sell in the list
      const updatedItems = items.map((item: CrossSell) =>
        item.id === updatedCrossSell.id ? updatedCrossSell : item
      );

      // Save updated settings
      const saveResponse = await fetch("/api/admin/onboarding-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          residentialCrossSells: {
            ...crossSellsSettings,
            items: updatedItems,
          },
        }),
      });

      if (!saveResponse.ok) throw new Error("Failed to save settings");

      setCrossSell(updatedCrossSell);
      setIsEditing(false);
      setSuccessMessage("Cross-Sell has been successfully edited.");

      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      throw err;
    }
  };

  // Filter clients by search query
  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (error || !crossSell) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-gray-500">
          <Link href="/app/office/settings" className="text-teal-600 hover:text-teal-700">
            SETTINGS
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/app/office/settings/residential-cross-sells"
            className="text-teal-600 hover:text-teal-700"
          >
            RESIDENTIAL CROSS-SELLS
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error || "Cross-sell not found"}
        </div>
        <button
          onClick={() => router.push("/app/office/settings/residential-cross-sells")}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cross-Sells
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <Link href="/app/office/settings" className="text-teal-600 hover:text-teal-700">
            SETTINGS
          </Link>
          <span className="mx-2">/</span>
          <Link
            href="/app/office/settings/residential-cross-sells"
            className="text-teal-600 hover:text-teal-700"
          >
            RESIDENTIAL CROSS-SELLS
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-400 uppercase">{crossSell.name}</span>
        </div>
        <button
          onClick={() => router.push("/app/office/settings/residential-cross-sells")}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{crossSell.name}</h1>
        <button
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700"
        >
          <Pencil className="w-4 h-4" />
          EDIT
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-teal-50 border border-teal-200 rounded-md p-4 text-teal-700 flex items-center gap-2">
          <span className="text-teal-500">✓</span>
          {successMessage}
        </div>
      )}

      {/* Info Section */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700">Info</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {/* Row 1: Name and Unit */}
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="px-6 py-4">
              <div className="text-sm text-gray-500 mb-1">Name</div>
              <div className="text-gray-900">{crossSell.name}</div>
            </div>
            <div className="px-6 py-4">
              <div className="text-sm text-gray-500 mb-1">Unit</div>
              <div className="text-gray-900">{crossSell.unit}</div>
            </div>
          </div>
          {/* Row 2: Description and Price per Unit */}
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="px-6 py-4">
              <div className="text-sm text-gray-500 mb-1">Description</div>
              <div className="text-gray-900">{crossSell.description || "—"}</div>
            </div>
            <div className="px-6 py-4">
              <div className="text-sm text-gray-500 mb-1">Price per Unit</div>
              <div className="text-gray-900">${(crossSell.pricePerUnit / 100).toFixed(2)}</div>
            </div>
          </div>
          {/* Row 3: Type and Taxable */}
          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="px-6 py-4">
              <div className="text-sm text-gray-500 mb-1">Type</div>
              <div className="text-gray-900">
                {crossSell.type === "SERVICE" ? "Service" : "Product"}
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="text-sm text-gray-500 mb-1">Taxable</div>
              <div className="text-gray-900">{crossSell.taxable ? "Yes" : "No"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Clients who use this Cross-Sell */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">Clients who use this Cross-Sell</h3>
          <div className="w-64">
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-teal-500 bg-transparent text-sm"
            />
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {filteredClients.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No clients are currently using this cross-sell
            </div>
          ) : (
            filteredClients.map((client) => (
              <div key={client.id} className="px-6 py-3">
                <Link
                  href={`/app/office/clients/${client.id}`}
                  className="text-teal-600 hover:text-teal-700 hover:underline"
                >
                  {client.name}
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Edit Modal */}
      {isEditing && (
        <CrossSellEditModal
          crossSell={crossSell}
          onClose={() => setIsEditing(false)}
          onSave={handleSaveCrossSell}
        />
      )}
    </div>
  );
}

interface CrossSellEditModalProps {
  crossSell: CrossSell;
  onClose: () => void;
  onSave: (crossSell: CrossSell) => Promise<void>;
}

function CrossSellEditModal({ crossSell, onClose, onSave }: CrossSellEditModalProps) {
  const [formData, setFormData] = useState<CrossSell>(crossSell);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState(
    crossSell.pricePerUnit ? (crossSell.pricePerUnit / 100).toFixed(2) : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formData);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save cross-sell");
    } finally {
      setSaving(false);
    }
  };

  const handlePriceChange = (value: string) => {
    setPriceInput(value);
  };

  const handlePriceBlur = () => {
    const cleanValue = priceInput.replace(/[^\d.]/g, "");
    const dollars = parseFloat(cleanValue) || 0;
    const cents = Math.round(dollars * 100);
    setFormData((prev) => ({ ...prev, pricePerUnit: cents }));
    setPriceInput((cents / 100).toFixed(2));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Edit Cross-Sell</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-4 space-y-5">
            {/* Cross-Sell Type */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">
                Please Select Cross-Sell Type*
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="SERVICE"
                    checked={formData.type === "SERVICE"}
                    onChange={() => setFormData((prev) => ({ ...prev, type: "SERVICE" }))}
                    className="w-4 h-4 text-teal-600"
                  />
                  <span className="text-sm text-gray-700">Service</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="PRODUCT"
                    checked={formData.type === "PRODUCT"}
                    onChange={() => setFormData((prev) => ({ ...prev, type: "PRODUCT" }))}
                    className="w-4 h-4 text-teal-600"
                  />
                  <span className="text-sm text-gray-700">Product</span>
                </label>
              </div>
            </div>

            {/* Name */}
            <div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
                placeholder="Name *"
                className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-teal-500 bg-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Description"
                className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-teal-500 bg-transparent"
              />
            </div>

            {/* Unit */}
            <div>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                required
                placeholder="Unit *"
                className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-teal-500 bg-transparent"
              />
            </div>

            {/* Price per Unit */}
            <div className="relative">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="text"
                value={priceInput}
                onChange={(e) => handlePriceChange(e.target.value)}
                onBlur={handlePriceBlur}
                required
                placeholder="Price per Unit *"
                className="w-full pl-4 pr-4 py-2 border-b border-gray-300 focus:outline-none focus:border-teal-500 bg-transparent"
              />
            </div>

            {/* Taxable */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.taxable}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, taxable: e.target.checked }))
                }
                className="w-4 h-4 text-teal-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Taxable</span>
            </label>

            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                {saveError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name || !formData.unit}
              className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "SAVE"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
