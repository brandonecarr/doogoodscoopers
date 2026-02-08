"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Store,
  Plus,
  Edit,
  Trash2,
  X,
  AlertCircle,
  Phone,
  Mail,
  Globe,
  DollarSign,
  Link2,
  FileText,
} from "lucide-react";

interface VendorDetail {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: Record<string, string>;
  payoutMethod: string;
  payoutDetails: Record<string, string>;
  commissionType: string;
  commissionValue: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

interface VendorService {
  id: string;
  name: string;
  description: string | null;
  vendorCostCents: number;
  costType: string;
  isActive: boolean;
}

interface AddOnLink {
  id: string;
  addOnId: string;
  addOnName: string | null;
  addOnPriceCents: number | null;
  vendorServiceId: string | null;
  vendorServiceName: string | null;
  vendorCostCents: number;
  isDefault: boolean;
  serviceAreaNotes: string | null;
  isActive: boolean;
}

interface CrossSellLink {
  id: string;
  crossSellId: string;
  crossSellType: string;
  vendorServiceId: string | null;
  vendorServiceName: string | null;
  vendorCostCents: number;
  isDefault: boolean;
  serviceAreaNotes: string | null;
  isActive: boolean;
}

interface CrossSellItem {
  id: string;
  name: string;
  pricePerUnit: number;
}

interface Payout {
  id: string;
  amountCents: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  createdAt: string;
}

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [services, setServices] = useState<VendorService[]>([]);
  const [addOnLinks, setAddOnLinks] = useState<AddOnLink[]>([]);
  const [crossSellLinks, setCrossSellLinks] = useState<CrossSellLink[]>([]);
  const [crossSellNames, setCrossSellNames] = useState<Record<string, string>>({});
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Service modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<VendorService | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    description: "",
    vendorCostCents: "",
    costType: "FIXED" as string,
    isActive: true,
  });

  // Link modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [availableAddOns, setAvailableAddOns] = useState<{ id: string; name: string; priceCents: number }[]>([]);
  const [linkForm, setLinkForm] = useState({
    addOnId: "",
    vendorServiceId: "",
    vendorCostCents: "",
    isDefault: false,
    serviceAreaNotes: "",
  });

  // Cross-sell link modal
  const [showCrossSellLinkModal, setShowCrossSellLinkModal] = useState(false);
  const [savingCrossSellLink, setSavingCrossSellLink] = useState(false);
  const [availableCrossSells, setAvailableCrossSells] = useState<CrossSellItem[]>([]);
  const [crossSellLinkForm, setCrossSellLinkForm] = useState({
    crossSellId: "",
    crossSellType: "RESIDENTIAL" as string,
    vendorServiceId: "",
    vendorCostCents: "",
    isDefault: false,
    serviceAreaNotes: "",
  });

  useEffect(() => {
    fetchVendor();
  }, [id]);

  async function fetchVendor() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors/${id}`);
      const data = await res.json();

      if (res.ok) {
        setVendor(data.vendor);
        setServices(data.services || []);
        setAddOnLinks(data.addOnLinks || []);
        setCrossSellLinks(data.crossSellLinks || []);
        setPayouts(data.payouts || []);

        // Fetch cross-sell names from onboarding settings
        if ((data.crossSellLinks || []).length > 0) {
          try {
            const settingsRes = await fetch("/api/admin/onboarding-settings");
            if (settingsRes.ok) {
              const settingsData = await settingsRes.json();
              const names: Record<string, string> = {};
              const residential = settingsData.settings?.residentialCrossSells?.items || [];
              const commercial = settingsData.settings?.commercialCrossSells?.items || [];
              for (const item of [...residential, ...commercial]) {
                names[item.id] = item.name;
              }
              setCrossSellNames(names);
            }
          } catch {
            // non-critical, just won't show names
          }
        }
      } else {
        setError(data.error || "Failed to load vendor");
      }
    } catch (err) {
      console.error("Error fetching vendor:", err);
      setError("Failed to load vendor");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAddOns() {
    try {
      const res = await fetch("/api/admin/add-ons?active=true");
      const data = await res.json();
      if (res.ok) {
        setAvailableAddOns((data.addOns || []).map((a: { id: string; name: string; priceCents: number }) => ({
          id: a.id,
          name: a.name,
          priceCents: a.priceCents,
        })));
      }
    } catch (err) {
      console.error("Error fetching add-ons:", err);
    }
  }

  // Service CRUD
  function openCreateService() {
    setEditingService(null);
    setServiceForm({ name: "", description: "", vendorCostCents: "", costType: "FIXED", isActive: true });
    setShowServiceModal(true);
    setError(null);
  }

  function openEditService(s: VendorService) {
    setEditingService(s);
    setServiceForm({
      name: s.name,
      description: s.description || "",
      vendorCostCents: (s.vendorCostCents / 100).toString(),
      costType: s.costType,
      isActive: s.isActive,
    });
    setShowServiceModal(true);
    setError(null);
  }

  async function handleSaveService(e: React.FormEvent) {
    e.preventDefault();
    setSavingService(true);
    setError(null);

    try {
      const payload = {
        vendorId: id,
        name: serviceForm.name,
        description: serviceForm.description || null,
        vendorCostCents: Math.round(parseFloat(serviceForm.vendorCostCents) * 100),
        costType: serviceForm.costType,
        isActive: serviceForm.isActive,
      };

      const res = await fetch("/api/admin/vendor-services", {
        method: editingService ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingService ? { id: editingService.id, ...payload } : payload),
      });

      const data = await res.json();
      if (res.ok) {
        setShowServiceModal(false);
        fetchVendor();
      } else {
        setError(data.error || "Failed to save service");
      }
    } catch (err) {
      console.error("Error saving service:", err);
      setError("Failed to save service");
    } finally {
      setSavingService(false);
    }
  }

  async function handleDeleteService(s: VendorService) {
    if (!confirm(`Delete service "${s.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/vendor-services?id=${s.id}`, { method: "DELETE" });
      if (res.ok) fetchVendor();
    } catch (err) {
      console.error("Error deleting service:", err);
    }
  }

  // Link CRUD
  function openCreateLink() {
    setLinkForm({ addOnId: "", vendorServiceId: "", vendorCostCents: "", isDefault: false, serviceAreaNotes: "" });
    setShowLinkModal(true);
    setError(null);
    fetchAddOns();
  }

  async function handleSaveLink(e: React.FormEvent) {
    e.preventDefault();
    setSavingLink(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/add-on-vendor-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addOnId: linkForm.addOnId,
          vendorId: id,
          vendorServiceId: linkForm.vendorServiceId || null,
          vendorCostCents: Math.round(parseFloat(linkForm.vendorCostCents) * 100),
          isDefault: linkForm.isDefault,
          serviceAreaNotes: linkForm.serviceAreaNotes || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowLinkModal(false);
        fetchVendor();
      } else {
        setError(data.error || "Failed to create link");
      }
    } catch (err) {
      console.error("Error creating link:", err);
      setError("Failed to create link");
    } finally {
      setSavingLink(false);
    }
  }

  async function handleDeleteLink(linkId: string) {
    if (!confirm("Remove this add-on link?")) return;
    try {
      const res = await fetch(`/api/admin/add-on-vendor-links?id=${linkId}`, { method: "DELETE" });
      if (res.ok) fetchVendor();
    } catch (err) {
      console.error("Error deleting link:", err);
    }
  }

  // Cross-sell link CRUD
  async function fetchCrossSells(type: string) {
    try {
      const res = await fetch("/api/admin/onboarding-settings");
      if (res.ok) {
        const data = await res.json();
        const key = type === "RESIDENTIAL" ? "residentialCrossSells" : "commercialCrossSells";
        const items = data.settings?.[key]?.items || [];
        setAvailableCrossSells(items.map((item: { id: string; name: string; pricePerUnit: number }) => ({
          id: item.id,
          name: item.name,
          pricePerUnit: item.pricePerUnit,
        })));
      }
    } catch (err) {
      console.error("Error fetching cross-sells:", err);
    }
  }

  function openCreateCrossSellLink() {
    setCrossSellLinkForm({ crossSellId: "", crossSellType: "RESIDENTIAL", vendorServiceId: "", vendorCostCents: "", isDefault: false, serviceAreaNotes: "" });
    setShowCrossSellLinkModal(true);
    setError(null);
    fetchCrossSells("RESIDENTIAL");
  }

  async function handleSaveCrossSellLink(e: React.FormEvent) {
    e.preventDefault();
    setSavingCrossSellLink(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/cross-sell-vendor-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crossSellId: crossSellLinkForm.crossSellId,
          crossSellType: crossSellLinkForm.crossSellType,
          vendorId: id,
          vendorServiceId: crossSellLinkForm.vendorServiceId || null,
          vendorCostCents: Math.round(parseFloat(crossSellLinkForm.vendorCostCents) * 100),
          isDefault: crossSellLinkForm.isDefault,
          serviceAreaNotes: crossSellLinkForm.serviceAreaNotes || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowCrossSellLinkModal(false);
        fetchVendor();
      } else {
        setError(data.error || "Failed to link cross-sell");
      }
    } catch (err) {
      console.error("Error linking cross-sell:", err);
      setError("Failed to link cross-sell");
    } finally {
      setSavingCrossSellLink(false);
    }
  }

  async function handleDeleteCrossSellLink(linkId: string) {
    if (!confirm("Remove this cross-sell link?")) return;
    try {
      const res = await fetch(`/api/admin/cross-sell-vendor-links?id=${linkId}`, { method: "DELETE" });
      if (res.ok) fetchVendor();
    } catch (err) {
      console.error("Error deleting cross-sell link:", err);
    }
  }

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (error && !vendor) {
    return (
      <div className="space-y-4">
        <Link href="/app/office/vendors" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Back to Vendors
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!vendor) return null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/app/office/vendors" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Vendors
      </Link>

      {/* Vendor Profile Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center">
              <Store className="w-7 h-7 text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  vendor.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {vendor.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              {vendor.contactName && (
                <p className="text-gray-600">{vendor.contactName}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {vendor.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" />
              {vendor.phone}
            </div>
          )}
          {vendor.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" />
              {vendor.email}
            </div>
          )}
          {vendor.website && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Globe className="w-4 h-4 text-gray-400" />
              <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">
                {vendor.website}
              </a>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Payout Method</p>
            <p className="font-medium text-gray-900">{vendor.payoutMethod}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Commission</p>
            <p className="font-medium text-gray-900">
              {vendor.commissionType === "PERCENTAGE"
                ? `${(vendor.commissionValue / 100).toFixed(1)}%`
                : formatCurrency(vendor.commissionValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Member Since</p>
            <p className="font-medium text-gray-900">
              {new Date(vendor.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Services</p>
            <p className="font-medium text-gray-900">{services.length}</p>
          </div>
        </div>

        {vendor.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{vendor.notes}</p>
          </div>
        )}
      </div>

      {/* Services Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900">Services</h2>
            <span className="text-sm text-gray-500">({services.length})</span>
          </div>
          <button
            onClick={openCreateService}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Service
          </button>
        </div>

        {services.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No services yet. Add a service to define what this vendor offers.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {services.map((s) => (
              <div key={s.id} className={`flex items-center gap-4 p-4 ${!s.isActive ? "opacity-60" : ""}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{s.name}</p>
                    {!s.isActive && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">Inactive</span>
                    )}
                  </div>
                  {s.description && <p className="text-sm text-gray-500">{s.description}</p>}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(s.vendorCostCents)}</p>
                  <p className="text-xs text-gray-500">{s.costType === "PER_VISIT" ? "per visit" : "fixed"}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEditService(s)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteService(s)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Add-Ons Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900">Linked Add-Ons</h2>
            <span className="text-sm text-gray-500">({addOnLinks.length})</span>
          </div>
          <button
            onClick={openCreateLink}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Link Add-On
          </button>
        </div>

        {addOnLinks.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No add-ons linked. Link this vendor to an add-on to assign them for fulfillment.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {addOnLinks.map((link) => (
              <div key={link.id} className={`flex items-center gap-4 p-4 ${!link.isActive ? "opacity-60" : ""}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{link.addOnName || "Unknown Add-On"}</p>
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
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    Client pays: <span className="font-medium text-gray-900">{formatCurrency(link.addOnPriceCents || 0)}</span>
                  </p>
                  <p className="text-sm text-gray-500">
                    Vendor cost: <span className="font-medium text-gray-900">{formatCurrency(link.vendorCostCents)}</span>
                  </p>
                </div>
                <button onClick={() => handleDeleteLink(link.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Cross-Sells Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900">Linked Cross-Sells</h2>
            <span className="text-sm text-gray-500">({crossSellLinks.length})</span>
          </div>
          <button
            onClick={openCreateCrossSellLink}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Link Cross-Sell
          </button>
        </div>

        {crossSellLinks.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No cross-sells linked. Link this vendor to a residential or commercial cross-sell.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {crossSellLinks.map((link) => (
              <div key={link.id} className={`flex items-center gap-4 p-4 ${!link.isActive ? "opacity-60" : ""}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/office/settings/${link.crossSellType.toLowerCase()}-cross-sells/${link.crossSellId}`}
                      className="font-medium text-teal-600 hover:text-teal-700 hover:underline"
                    >
                      {crossSellNames[link.crossSellId] || link.crossSellId}
                    </Link>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      link.crossSellType === "RESIDENTIAL" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {link.crossSellType}
                    </span>
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
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(link.vendorCostCents)}</p>
                  <p className="text-xs text-gray-500">vendor cost</p>
                </div>
                <button onClick={() => handleDeleteCrossSellLink(link.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Payouts Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-gray-900">Recent Payouts</h2>
            <span className="text-sm text-gray-500">({payouts.length})</span>
          </div>
          <Link
            href={`/app/office/vendors/payouts?vendorId=${id}`}
            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            View All
          </Link>
        </div>

        {payouts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No payouts recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {payouts.map((p) => (
              <Link
                key={p.id}
                href={`/app/office/vendors/payouts/${p.id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{formatCurrency(p.amountCents)}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(p.periodStart).toLocaleDateString()} - {new Date(p.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  p.status === "PAID" ? "bg-green-100 text-green-700" :
                  p.status === "CANCELED" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {p.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingService ? "Edit Service" : "Add Service"}
              </h2>
              <button onClick={() => setShowServiceModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveService} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="e.g., Lawn Mowing"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Cost ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={serviceForm.vendorCostCents}
                    onChange={(e) => setServiceForm({ ...serviceForm, vendorCostCents: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Type</label>
                  <select
                    value={serviceForm.costType}
                    onChange={(e) => setServiceForm({ ...serviceForm, costType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="FIXED">Fixed</option>
                    <option value="PER_VISIT">Per Visit</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowServiceModal(false)} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
                <button type="submit" disabled={savingService} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {savingService ? "Saving..." : editingService ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Cross-Sell Modal */}
      {showCrossSellLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Link Cross-Sell to Vendor</h2>
              <button onClick={() => setShowCrossSellLinkModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCrossSellLink} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cross-Sell Type *</label>
                <select
                  value={crossSellLinkForm.crossSellType}
                  onChange={(e) => {
                    setCrossSellLinkForm({ ...crossSellLinkForm, crossSellType: e.target.value, crossSellId: "" });
                    fetchCrossSells(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="RESIDENTIAL">Residential</option>
                  <option value="COMMERCIAL">Commercial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cross-Sell *</label>
                <select
                  value={crossSellLinkForm.crossSellId}
                  onChange={(e) => setCrossSellLinkForm({ ...crossSellLinkForm, crossSellId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select a cross-sell...</option>
                  {availableCrossSells.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.name} ({formatCurrency(cs.pricePerUnit)})
                    </option>
                  ))}
                </select>
              </div>
              {services.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Service (optional)</label>
                  <select
                    value={crossSellLinkForm.vendorServiceId}
                    onChange={(e) => setCrossSellLinkForm({ ...crossSellLinkForm, vendorServiceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">None</option>
                    {services.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatCurrency(s.vendorCostCents)})
                      </option>
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
                  value={crossSellLinkForm.vendorCostCents}
                  onChange={(e) => setCrossSellLinkForm({ ...crossSellLinkForm, vendorCostCents: e.target.value })}
                  placeholder="What you pay the vendor"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Area Notes</label>
                <input
                  type="text"
                  value={crossSellLinkForm.serviceAreaNotes}
                  onChange={(e) => setCrossSellLinkForm({ ...crossSellLinkForm, serviceAreaNotes: e.target.value })}
                  placeholder="e.g., North side only"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Default Vendor</p>
                  <p className="text-sm text-gray-500">Preferred vendor for this cross-sell</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCrossSellLinkForm({ ...crossSellLinkForm, isDefault: !crossSellLinkForm.isDefault })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${crossSellLinkForm.isDefault ? "bg-teal-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${crossSellLinkForm.isDefault ? "translate-x-5" : ""}`} />
                </button>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCrossSellLinkModal(false)} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
                <button type="submit" disabled={savingCrossSellLink} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {savingCrossSellLink ? "Linking..." : "Link Cross-Sell"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Add-On Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Link Add-On to Vendor</h2>
              <button onClick={() => setShowLinkModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveLink} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add-On *</label>
                <select
                  value={linkForm.addOnId}
                  onChange={(e) => setLinkForm({ ...linkForm, addOnId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select an add-on...</option>
                  {availableAddOns.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatCurrency(a.priceCents)})
                    </option>
                  ))}
                </select>
              </div>
              {services.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Service (optional)</label>
                  <select
                    value={linkForm.vendorServiceId}
                    onChange={(e) => setLinkForm({ ...linkForm, vendorServiceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">None</option>
                    {services.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({formatCurrency(s.vendorCostCents)})
                      </option>
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
                  value={linkForm.vendorCostCents}
                  onChange={(e) => setLinkForm({ ...linkForm, vendorCostCents: e.target.value })}
                  placeholder="What you pay the vendor"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Area Notes</label>
                <input
                  type="text"
                  value={linkForm.serviceAreaNotes}
                  onChange={(e) => setLinkForm({ ...linkForm, serviceAreaNotes: e.target.value })}
                  placeholder="e.g., North side only"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Default Vendor</p>
                  <p className="text-sm text-gray-500">Preferred vendor for this add-on</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLinkForm({ ...linkForm, isDefault: !linkForm.isDefault })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${linkForm.isDefault ? "bg-teal-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${linkForm.isDefault ? "translate-x-5" : ""}`} />
                </button>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowLinkModal(false)} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Cancel
                </button>
                <button type="submit" disabled={savingLink} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                  {savingLink ? "Linking..." : "Link Add-On"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
