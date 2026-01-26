"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, X, Eye, Info } from "lucide-react";

interface CrossSell {
  id: string;
  name: string;
  description: string;
  unit: string;
  pricePerUnit: number; // in cents
  type: "SERVICE" | "PRODUCT";
  taxable: boolean;
}

interface CrossSellsSettings {
  items: CrossSell[];
  placement: "TOP" | "BOTTOM" | "DONT_SHOW";
}

const defaultCrossSell: Omit<CrossSell, "id"> = {
  name: "",
  description: "",
  unit: "",
  pricePerUnit: 0,
  type: "SERVICE",
  taxable: false,
};

export default function ResidentialCrossSellsPage() {
  const [crossSells, setCrossSells] = useState<CrossSell[]>([]);
  const [placement, setPlacement] = useState<"TOP" | "BOTTOM" | "DONT_SHOW">("BOTTOM");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCrossSell, setEditingCrossSell] = useState<CrossSell | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingCrossSell, setViewingCrossSell] = useState<CrossSell | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/onboarding-settings");
      if (response.ok) {
        const data = await response.json();
        const crossSellsSettings = data.settings?.residentialCrossSells || {};
        setCrossSells(crossSellsSettings.items || []);
        setPlacement(crossSellsSettings.placement || "BOTTOM");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const saveSettings = async (items: CrossSell[], newPlacement?: "TOP" | "BOTTOM" | "DONT_SHOW") => {
    const response = await fetch("/api/admin/onboarding-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        residentialCrossSells: {
          items,
          placement: newPlacement || placement,
        },
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save settings");
    }
  };

  const handleSavePlacement = async () => {
    setSaving(true);
    try {
      await saveSettings(crossSells, placement);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save placement");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = () => {
    setEditingCrossSell({
      id: "",
      ...defaultCrossSell,
    });
    setIsCreating(true);
  };

  const handleSaveCrossSell = async (crossSell: CrossSell) => {
    let updatedItems: CrossSell[];

    if (isCreating) {
      const newCrossSell = {
        ...crossSell,
        id: crypto.randomUUID(),
      };
      updatedItems = [...crossSells, newCrossSell];
    } else {
      updatedItems = crossSells.map((item) =>
        item.id === crossSell.id ? crossSell : item
      );
    }

    await saveSettings(updatedItems);
    setCrossSells(updatedItems);
    setEditingCrossSell(null);
    setIsCreating(false);
  };

  const handleDelete = async (crossSellId: string) => {
    if (!confirm("Are you sure you want to delete this cross-sell?")) return;

    try {
      const updatedItems = crossSells.filter((item) => item.id !== crossSellId);
      await saveSettings(updatedItems);
      setCrossSells(updatedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete cross-sell");
    }
  };

  // Filter and pagination
  const filteredCrossSells = crossSells.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.ceil(filteredCrossSells.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCrossSells = filteredCrossSells.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link href="/app/office/settings" className="text-teal-600 hover:text-teal-700">
          SETTINGS
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-400">RESIDENTIAL CROSS-SELLS</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Residential Cross-Sells</h1>
      </div>

      {/* Search and Add Button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2 border-b border-gray-300 focus:outline-none focus:border-teal-500 bg-transparent"
          />
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700"
        >
          ADD NEW
        </button>
      </div>

      {/* Cross-Sells Table */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Description</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Unit</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Price per Unit</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Taxable</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCrossSells.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedCrossSells.map((crossSell) => (
                  <tr key={crossSell.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{crossSell.name}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 max-w-md truncate">
                      {crossSell.description}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{crossSell.unit}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      ${(crossSell.pricePerUnit / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {crossSell.type === "SERVICE" ? "Service" : "Product"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {crossSell.taxable ? "Yes" : "No"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setViewingCrossSell(crossSell)}
                          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                        >
                          View
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingCrossSell(crossSell);
                            setIsCreating(false);
                          }}
                          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                        >
                          Edit
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(crossSell.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-4 p-4 text-sm text-gray-600 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span>Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <span>
            {filteredCrossSells.length === 0
              ? "0-0"
              : `${startIndex + 1}-${Math.min(endIndex, filteredCrossSells.length)}`}{" "}
            of {filteredCrossSells.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              |&lt;
            </button>
            <button
              onClick={() => setCurrentPage((prev) => prev - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              &lt;
            </button>
            <button
              onClick={() => setCurrentPage((prev) => prev + 1)}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              &gt;
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="px-2 py-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              &gt;|
            </button>
          </div>
        </div>
      </section>

      {/* Cross-Sells Placement */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Cross-Sells placement on the Client Onboarding Form
        </h3>

        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="placement"
              value="TOP"
              checked={placement === "TOP"}
              onChange={() => setPlacement("TOP")}
              className="w-4 h-4 text-teal-600"
            />
            <span className="text-sm text-gray-700">Top</span>
            <button className="text-gray-400 hover:text-gray-600">
              <Info className="w-4 h-4" />
            </button>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="placement"
              value="BOTTOM"
              checked={placement === "BOTTOM"}
              onChange={() => setPlacement("BOTTOM")}
              className="w-4 h-4 text-teal-600"
            />
            <span className="text-sm text-gray-700">Bottom</span>
            <button className="text-gray-400 hover:text-gray-600">
              <Info className="w-4 h-4" />
            </button>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="placement"
              value="DONT_SHOW"
              checked={placement === "DONT_SHOW"}
              onChange={() => setPlacement("DONT_SHOW")}
              className="w-4 h-4 text-teal-600"
            />
            <span className="text-sm text-gray-700">Don&apos;t Show</span>
          </label>
        </div>

        <button
          onClick={handleSavePlacement}
          disabled={saving}
          className="px-6 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "SAVE"}
        </button>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editingCrossSell && (
        <CrossSellEditModal
          crossSell={editingCrossSell}
          isCreating={isCreating}
          onClose={() => {
            setEditingCrossSell(null);
            setIsCreating(false);
          }}
          onSave={handleSaveCrossSell}
        />
      )}

      {/* View Modal */}
      {viewingCrossSell && (
        <CrossSellViewModal
          crossSell={viewingCrossSell}
          onClose={() => setViewingCrossSell(null)}
        />
      )}
    </div>
  );
}

interface CrossSellEditModalProps {
  crossSell: CrossSell;
  isCreating: boolean;
  onClose: () => void;
  onSave: (crossSell: CrossSell) => Promise<void>;
}

function CrossSellEditModal({
  crossSell,
  isCreating,
  onClose,
  onSave,
}: CrossSellEditModalProps) {
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
            <h3 className="text-lg font-semibold text-gray-900">
              {isCreating ? "Add New Cross-Sell" : "Edit Cross-Sell"}
            </h3>
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
              <div className="mt-3 bg-blue-50 border-l-4 border-blue-400 p-3 flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700">
                  Example: Enter &quot;15 min&quot; for the unit if your service is Doggie
                  Playtime.{" "}
                  <a href="#" className="text-blue-600 hover:underline">
                    Learn more
                  </a>
                </p>
              </div>
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

interface CrossSellViewModalProps {
  crossSell: CrossSell;
  onClose: () => void;
}

function CrossSellViewModal({ crossSell, onClose }: CrossSellViewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Cross-Sell Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-sm text-gray-500">Name</label>
            <p className="text-gray-900">{crossSell.name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Description</label>
            <p className="text-gray-900">{crossSell.description || "—"}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Unit</label>
            <p className="text-gray-900">{crossSell.unit}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Price per Unit</label>
            <p className="text-gray-900">${(crossSell.pricePerUnit / 100).toFixed(2)}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Type</label>
            <p className="text-gray-900">
              {crossSell.type === "SERVICE" ? "Service" : "Product"}
            </p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Taxable</label>
            <p className="text-gray-900">{crossSell.taxable ? "Yes" : "No"}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
