"use client";

import { useState, useEffect, useCallback } from "react";

interface ZipCodeData {
  regular: string[];
  premium: string[];
}

export default function ServiceAreaSetup() {
  const [zipCodes, setZipCodes] = useState<ZipCodeData>({ regular: [], premium: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Input states
  const [addRegularInput, setAddRegularInput] = useState("");
  const [deleteRegularInput, setDeleteRegularInput] = useState("");
  const [addPremiumInput, setAddPremiumInput] = useState("");
  const [deletePremiumInput, setDeletePremiumInput] = useState("");

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchZipCodes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/service-area");
      if (!response.ok) {
        throw new Error("Failed to fetch zip codes");
      }
      const data = await response.json();
      setZipCodes(data.zipCodes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load zip codes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZipCodes();
  }, [fetchZipCodes]);

  const handleAction = async (
    action: "add" | "delete",
    zone: "REGULAR" | "PREMIUM",
    zipCodesInput: string,
    setInput: (value: string) => void
  ) => {
    const actionKey = `${action}-${zone}`;
    setActionLoading(actionKey);
    setActionSuccess(null);

    try {
      // Parse comma-separated zip codes
      const zips = zipCodesInput
        .split(",")
        .map((z) => z.trim())
        .filter((z) => /^\d{5}$/.test(z));

      if (zips.length === 0) {
        throw new Error("Please enter valid 5-digit ZIP codes");
      }

      const response = await fetch("/api/admin/service-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, zone, zipCodes: zips }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update zip codes");
      }

      // Refresh the zip codes
      await fetchZipCodes();
      setInput("");
      setActionSuccess(actionKey);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      {/* Regular Pricing Zip Codes */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Regular Pricing Zip Codes</h2>

        {/* Zip Code Grid */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6 min-h-[120px]">
          {zipCodes.regular.length === 0 ? (
            <p className="text-gray-500 text-sm">No regular pricing zip codes configured</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {zipCodes.regular.sort().map((zip) => (
                <span
                  key={zip}
                  className="inline-block px-3 py-1 bg-white border border-gray-300 rounded text-sm text-gray-700"
                >
                  {zip}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Add Regular Zip Codes */}
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm text-gray-600 w-48 flex-shrink-0">
            Add Regular Pricing Zip Codes
          </label>
          <input
            type="text"
            value={addRegularInput}
            onChange={(e) => setAddRegularInput(e.target.value)}
            placeholder="Add new Zip Codes"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
          />
          <button
            onClick={() =>
              handleAction("add", "REGULAR", addRegularInput, setAddRegularInput)
            }
            disabled={actionLoading === "add-REGULAR" || !addRegularInput.trim()}
            className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "add-REGULAR" ? "Adding..." : "Add"}
          </button>
          {actionSuccess === "add-REGULAR" && (
            <span className="text-green-600 text-sm">✓</span>
          )}
        </div>

        {/* Delete Regular Zip Codes */}
        <div className="flex items-center gap-4 mb-6">
          <label className="text-sm text-gray-600 w-48 flex-shrink-0">
            Delete Regular Pricing Zip Codes
          </label>
          <input
            type="text"
            value={deleteRegularInput}
            onChange={(e) => setDeleteRegularInput(e.target.value)}
            placeholder="Delete Zip Codes"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500"
          />
          <button
            onClick={() =>
              handleAction("delete", "REGULAR", deleteRegularInput, setDeleteRegularInput)
            }
            disabled={actionLoading === "delete-REGULAR" || !deleteRegularInput.trim()}
            className="px-6 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "delete-REGULAR" ? "Deleting..." : "Delete"}
          </button>
          {actionSuccess === "delete-REGULAR" && (
            <span className="text-green-600 text-sm">✓</span>
          )}
        </div>

        {/* How to use */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-600">
          <p className="font-medium mb-2">How to use</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Comma(,) acts like a separator</li>
            <li>
              Example: If you want to add/remove 80002, 80003, 80004, 80005, 80006, 80007, 80008,
              80009, 80010 to modify Zip Code Service Area, the input should be:
              <ul className="ml-6 mt-1 space-y-1">
                <li>80002 or</li>
                <li>80002, 80004, 80010, 80008, 80003, 80011, 80013</li>
              </ul>
            </li>
          </ul>
        </div>
      </section>

      {/* Premium Pricing Zip Codes */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Premium Pricing Zip Codes</h2>

        {/* Zip Code Grid */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6 min-h-[120px]">
          {zipCodes.premium.length === 0 ? (
            <p className="text-gray-500 text-sm">No premium pricing zip codes configured</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {zipCodes.premium.sort().map((zip) => (
                <span
                  key={zip}
                  className="inline-block px-3 py-1 bg-white border border-gray-300 rounded text-sm text-gray-700"
                >
                  {zip}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Add Premium Zip Codes */}
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm text-gray-600 w-48 flex-shrink-0">
            Add Premium Pricing Zip Codes
          </label>
          <input
            type="text"
            value={addPremiumInput}
            onChange={(e) => setAddPremiumInput(e.target.value)}
            placeholder="Add new Zip Codes"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
          />
          <button
            onClick={() =>
              handleAction("add", "PREMIUM", addPremiumInput, setAddPremiumInput)
            }
            disabled={actionLoading === "add-PREMIUM" || !addPremiumInput.trim()}
            className="px-6 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "add-PREMIUM" ? "Adding..." : "Add"}
          </button>
          {actionSuccess === "add-PREMIUM" && (
            <span className="text-green-600 text-sm">✓</span>
          )}
        </div>

        {/* Delete Premium Zip Codes */}
        <div className="flex items-center gap-4 mb-6">
          <label className="text-sm text-gray-600 w-48 flex-shrink-0">
            Delete Premium Pricing Zip Codes
          </label>
          <input
            type="text"
            value={deletePremiumInput}
            onChange={(e) => setDeletePremiumInput(e.target.value)}
            placeholder="Delete Zip Codes"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500"
          />
          <button
            onClick={() =>
              handleAction("delete", "PREMIUM", deletePremiumInput, setDeletePremiumInput)
            }
            disabled={actionLoading === "delete-PREMIUM" || !deletePremiumInput.trim()}
            className="px-6 py-2 bg-red-500 text-white text-sm font-medium rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {actionLoading === "delete-PREMIUM" ? "Deleting..." : "Delete"}
          </button>
          {actionSuccess === "delete-PREMIUM" && (
            <span className="text-green-600 text-sm">✓</span>
          )}
        </div>

        {/* How to use (same as above) */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-600">
          <p className="font-medium mb-2">How to use</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Comma(,) acts like a separator</li>
            <li>
              Example: If you want to add/remove 80002, 80003, 80004, 80005, 80006, 80007, 80008,
              80009, 80010 to modify Zip Code Service Area, the input should be:
              <ul className="ml-6 mt-1 space-y-1">
                <li>80002 or</li>
                <li>80002, 80004, 80010, 80008, 80003, 80011, 80013</li>
              </ul>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
