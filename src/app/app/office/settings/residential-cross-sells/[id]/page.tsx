"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, X, Plus, Trash2, Store } from "lucide-react";

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

interface CrossSellVendorLink {
  id: string;
  crossSellId: string;
  vendorId: string;
  vendorName: string | null;
  vendorServiceId: string | null;
  vendorServiceName: string | null;
  vendorCostCents: number;
  isDefault: boolean;
  serviceAreaNotes: string | null;
  isActive: boolean;
}

interface Vendor {
  id: string;
  name: string;
}

interface VendorService {
  id: string;
  name: string;
  vendorCostCents: number;
}

export default function CrossSellDetailPage() {
  const params = useParams();
  const router = useRouter();
  const crossSellId = params.id as string;

  const [crossSell, setCrossSell] = useState<CrossSell | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [vendorLinks, setVendorLinks] = useState<CrossSellVendorLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Vendor link modal
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [savingVendorLink, setSavingVendorLink] = useState(false);
  const [availableVendors, setAvailableVendors] = useState<Vendor[]>([]);
  const [vendorServices, setVendorServices] = useState<VendorService[]>([]);
  const [vendorLinkForm, setVendorLinkForm] = useState({
    vendorId: "",
    vendorServiceId: "",
    vendorCostCents: "",
    isDefault: false,
    serviceAreaNotes: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, linksRes] = await Promise.all([
        fetch("/api/admin/onboarding-settings"),
        fetch(`/api/admin/cross-sell-vendor-links?crossSellId=${crossSellId}&crossSellType=RESIDENTIAL`),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const crossSellsSettings = data.settings?.residentialCrossSells || {};
        const items = crossSellsSettings.items || [];
        const foundCrossSell = items.find((item: CrossSell) => item.id === crossSellId);

        if (foundCrossSell) {
          setCrossSell(foundCrossSell);
        } else {
          setError("Cross-sell not found");
        }
      }

      if (linksRes.ok) {
        const linksData = await linksRes.json();
        setVendorLinks(linksData.links || []);
      }

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

  async function fetchVendors() {
    try {
      const res = await fetch("/api/admin/vendors?active=true");
      if (res.ok) {
        const data = await res.json();
        setAvailableVendors(
          (data.vendors || []).map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }))
        );
      }
    } catch (err) {
      console.error("Error fetching vendors:", err);
    }
  }

  async function fetchVendorServices(vendorId: string) {
    try {
      const res = await fetch(`/api/admin/vendor-services?vendorId=${vendorId}&active=true`);
      if (res.ok) {
        const data = await res.json();
        setVendorServices(
          (data.services || []).map((s: { id: string; name: string; vendorCostCents: number }) => ({
            id: s.id,
            name: s.name,
            vendorCostCents: s.vendorCostCents,
          }))
        );
      }
    } catch (err) {
      console.error("Error fetching vendor services:", err);
    }
  }

  function openAddVendor() {
    setVendorLinkForm({ vendorId: "", vendorServiceId: "", vendorCostCents: "", isDefault: false, serviceAreaNotes: "" });
    setVendorServices([]);
    setShowVendorModal(true);
    fetchVendors();
  }

  async function handleSaveVendorLink(e: React.FormEvent) {
    e.preventDefault();
    setSavingVendorLink(true);
    try {
      const res = await fetch("/api/admin/cross-sell-vendor-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crossSellId,
          crossSellType: "RESIDENTIAL",
          vendorId: vendorLinkForm.vendorId,
          vendorServiceId: vendorLinkForm.vendorServiceId || null,
          vendorCostCents: Math.round(parseFloat(vendorLinkForm.vendorCostCents) * 100),
          isDefault: vendorLinkForm.isDefault,
          serviceAreaNotes: vendorLinkForm.serviceAreaNotes || null,
        }),
      });
      if (res.ok) {
        setShowVendorModal(false);
        fetchData();
        setSuccessMessage("Vendor linked successfully.");
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to link vendor");
      }
    } catch (err) {
      console.error("Error linking vendor:", err);
      setError("Failed to link vendor");
    } finally {
      setSavingVendorLink(false);
    }
  }

  async function handleDeleteVendorLink(linkId: string) {
    if (!confirm("Remove this vendor link?")) return;
    try {
      const res = await fetch(`/api/admin/cross-sell-vendor-links?id=${linkId}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (err) {
      console.error("Error deleting vendor link:", err);
    }
  }

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

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

      {/* Assigned Vendors */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-medium text-gray-700">Assigned Vendors</h3>
            <span className="text-xs text-gray-500">({vendorLinks.length})</span>
          </div>
          <button
            onClick={openAddVendor}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700"
          >
            <Plus className="w-3.5 h-3.5" /> Add Vendor
          </button>
        </div>
        {vendorLinks.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500 text-sm">
            No vendors assigned. Link a vendor to fulfill this cross-sell.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {vendorLinks.map((link) => (
              <div key={link.id} className="flex items-center gap-4 px-6 py-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/office/vendors/${link.vendorId}`}
                      className="font-medium text-teal-600 hover:text-teal-700 hover:underline"
                    >
                      {link.vendorName || "Unknown Vendor"}
                    </Link>
                    {link.isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full">Default</span>
                    )}
                  </div>
                  {link.vendorServiceName && (
                    <p className="text-sm text-gray-500">Service: {link.vendorServiceName}</p>
                  )}
                  {link.serviceAreaNotes && (
                    <p className="text-xs text-gray-400 mt-0.5">{link.serviceAreaNotes}</p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-600">
                  <p>Vendor cost: <span className="font-medium text-gray-900">{formatCurrency(link.vendorCostCents)}</span></p>
                </div>
                <button
                  onClick={() => handleDeleteVendorLink(link.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
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

      {/* Add Vendor Link Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveVendorLink}>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Assign Vendor</h3>
                <button type="button" onClick={() => setShowVendorModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor *</label>
                  <select
                    value={vendorLinkForm.vendorId}
                    onChange={(e) => {
                      setVendorLinkForm({ ...vendorLinkForm, vendorId: e.target.value, vendorServiceId: "" });
                      if (e.target.value) fetchVendorServices(e.target.value);
                      else setVendorServices([]);
                    }}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Select a vendor...</option>
                    {availableVendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                {vendorServices.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Service (optional)</label>
                    <select
                      value={vendorLinkForm.vendorServiceId}
                      onChange={(e) => setVendorLinkForm({ ...vendorLinkForm, vendorServiceId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      <option value="">None</option>
                      {vendorServices.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.vendorCostCents)})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Cost ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={vendorLinkForm.vendorCostCents}
                    onChange={(e) => setVendorLinkForm({ ...vendorLinkForm, vendorCostCents: e.target.value })}
                    placeholder="What you pay the vendor"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Area Notes</label>
                  <input
                    type="text"
                    value={vendorLinkForm.serviceAreaNotes}
                    onChange={(e) => setVendorLinkForm({ ...vendorLinkForm, serviceAreaNotes: e.target.value })}
                    placeholder="e.g., North side only"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vendorLinkForm.isDefault}
                    onChange={(e) => setVendorLinkForm({ ...vendorLinkForm, isDefault: e.target.checked })}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Default vendor for this cross-sell</span>
                </label>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button type="button" onClick={() => setShowVendorModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                  CANCEL
                </button>
                <button type="submit" disabled={savingVendorLink} className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50">
                  {savingVendorLink ? "Saving..." : "ASSIGN"}
                </button>
              </div>
            </form>
          </div>
        </div>
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
