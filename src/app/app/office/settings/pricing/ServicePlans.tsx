"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, HelpCircle, X, Trash, Check } from "lucide-react";

// Frequency options
const FREQUENCY_OPTIONS = [
  { value: "SEVEN_TIMES_A_WEEK", label: "Seven Times A Week" },
  { value: "SIX_TIMES_A_WEEK", label: "Six Times A Week" },
  { value: "FIVE_TIMES_A_WEEK", label: "Five Times A Week" },
  { value: "FOUR_TIMES_A_WEEK", label: "Four Times A Week" },
  { value: "THREE_TIMES_A_WEEK", label: "Three Times A Week" },
  { value: "TWICE_WEEKLY", label: "Two Times A Week" },
  { value: "WEEKLY", label: "Once A Week" },
  { value: "BIWEEKLY", label: "Bi-Weekly" },
  { value: "TWICE_PER_MONTH", label: "Twice Per Month" },
  { value: "EVERY_THREE_WEEKS", label: "Every Three Weeks" },
  { value: "EVERY_FOUR_WEEKS", label: "Every Four Weeks" },
  { value: "MONTHLY", label: "Once A Month" },
  { value: "ONETIME", label: "One-Time" },
];

const BILLING_INTERVALS = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "BIWEEKLY", label: "Bi-Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "ANNUALLY", label: "Annually" },
];

const BILLING_OPTIONS = [
  { value: "PREPAID_FIXED", label: "Prepaid Fixed" },
  { value: "PREPAID_VARIABLE", label: "Prepaid Variable" },
  { value: "POSTPAID", label: "Postpaid" },
];

interface ServicePlan {
  id: string;
  name: string;
  type: "SERVICE" | "PRODUCT";
  frequency: string;
  price: number; // in cents
  billingInterval: string;
  billingOption: string;
  taxable: boolean;
  displayOrder: number;
  isFeatured: boolean;
  featuredLabel: string;
  descriptions: string[];
  buttonColor: string;
  backgroundColor: string;
  featuredColor: string;
  is_active: boolean;
}

interface ServicePlansSettings {
  enableDisplay: boolean;
  disclaimer: string;
  enableCustomPricingLink: boolean;
}

const defaultPlan: Omit<ServicePlan, "id"> = {
  name: "",
  type: "SERVICE",
  frequency: "WEEKLY",
  price: 0,
  billingInterval: "MONTHLY",
  billingOption: "PREPAID_FIXED",
  taxable: false,
  displayOrder: 1,
  isFeatured: false,
  featuredLabel: "",
  descriptions: [""],
  buttonColor: "#000000",
  backgroundColor: "#F4F4F4",
  featuredColor: "#000000",
  is_active: true,
};

export default function ServicePlans() {
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<ServicePlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [settings, setSettings] = useState<ServicePlansSettings>({
    enableDisplay: false,
    disclaimer: "",
    enableCustomPricingLink: false,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch service plans
      const plansResponse = await fetch("/api/admin/service-plans");
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        setPlans(plansData.plans || []);
      }

      // Fetch settings
      const settingsResponse = await fetch("/api/admin/onboarding-settings");
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        const servicePlansSettings = settingsData.settings?.servicePlans || {};
        setSettings({
          enableDisplay: servicePlansSettings.enableDisplay || false,
          disclaimer: servicePlansSettings.disclaimer || "",
          enableCustomPricingLink: servicePlansSettings.enableCustomPricingLink || false,
        });
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

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/onboarding-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicePlans: settings,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = () => {
    setEditingPlan({
      id: "",
      ...defaultPlan,
      displayOrder: plans.length + 1,
    });
    setIsCreating(true);
  };

  const handleSavePlan = async (plan: ServicePlan) => {
    try {
      if (isCreating) {
        const response = await fetch("/api/admin/service-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plan),
        });
        if (!response.ok) throw new Error("Failed to create plan");
      } else {
        const response = await fetch("/api/admin/service-plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plan),
        });
        if (!response.ok) throw new Error("Failed to update plan");
      }
      await fetchData();
      setEditingPlan(null);
      setIsCreating(false);
    } catch (err) {
      throw err;
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this service plan?")) return;

    try {
      const response = await fetch(`/api/admin/service-plans?id=${planId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete plan");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan");
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    return FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label || frequency;
  };

  // Pagination
  const totalPages = Math.ceil(plans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPlans = plans.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Enable Display Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setSettings(prev => ({ ...prev, enableDisplay: !prev.enableDisplay }))}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.enableDisplay ? "bg-teal-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.enableDisplay ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
        <span className="text-sm text-gray-700">Enable display of service plans</span>
      </div>

      {/* Service Plans Table */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Service Plans</h3>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            CREATE NEW PLAN
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Order</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Service Plan Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Featured</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Cleanup Frequency</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Price</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Taxable</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedPlans.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              ) : (
                paginatedPlans.map((plan) => (
                  <tr key={plan.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{plan.displayOrder}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{plan.name}</td>
                    <td className="py-3 px-4">
                      {plan.isFeatured ? (
                        <Check className="w-5 h-5 text-teal-600" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {getFrequencyLabel(plan.frequency)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      ${(plan.price / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {plan.type === "SERVICE" ? "Service" : "Product"}
                    </td>
                    <td className="py-3 px-4">
                      {plan.taxable ? (
                        <Check className="w-5 h-5 text-teal-600" />
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingPlan(plan);
                            setIsCreating(false);
                          }}
                          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                        >
                          Edit
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(plan.id)}
                          className="p-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
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
        <div className="flex items-center justify-end gap-4 mt-4 text-sm text-gray-600">
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
            {plans.length === 0 ? "0-0" : `${startIndex + 1}-${Math.min(endIndex, plans.length)}`} of {plans.length}
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
              onClick={() => setCurrentPage(prev => prev - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              &lt;
            </button>
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
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

      {/* Service Plans Disclaimer */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Service Plans Disclaimer</h3>
        <p className="text-sm text-gray-600 mb-4">
          Disclaimer text will be displayed below service plans table.
        </p>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <input
              type="text"
              value={settings.disclaimer}
              onChange={(e) => setSettings(prev => ({ ...prev, disclaimer: e.target.value }))}
              placeholder="Service Plans Disclaimer"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button className="text-gray-400 hover:text-gray-600">
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-sm text-blue-700 mb-4">
          Leave field blank if you don&apos;t want to show disclaimer on the service plan table.
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="px-6 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "SAVE"}
        </button>
      </section>

      {/* Custom Pricing Link */}
      <section className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Custom Pricing Link</h3>
        <p className="text-sm text-gray-600 mb-4">
          If a user clicks the link he will be redirected to the standard Client Onboarding form
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSettings(prev => ({ ...prev, enableCustomPricingLink: !prev.enableCustomPricingLink }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enableCustomPricingLink ? "bg-teal-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.enableCustomPricingLink ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">Enable display of custom pricing link.</span>
          <button className="text-gray-400 hover:text-gray-600">
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editingPlan && (
        <PlanEditModal
          plan={editingPlan}
          isCreating={isCreating}
          existingPlansCount={plans.length}
          onClose={() => {
            setEditingPlan(null);
            setIsCreating(false);
          }}
          onSave={handleSavePlan}
        />
      )}
    </div>
  );
}

interface PlanEditModalProps {
  plan: ServicePlan;
  isCreating: boolean;
  existingPlansCount: number;
  onClose: () => void;
  onSave: (plan: ServicePlan) => Promise<void>;
}

function PlanEditModal({ plan, isCreating, existingPlansCount, onClose, onSave }: PlanEditModalProps) {
  const [formData, setFormData] = useState<ServicePlan>(plan);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState((plan.price / 100).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formData);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save plan");
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
    setFormData(prev => ({ ...prev, price: cents }));
    setPriceInput((cents / 100).toFixed(2));
  };

  const addDescription = () => {
    setFormData(prev => ({
      ...prev,
      descriptions: [...prev.descriptions, ""],
    }));
  };

  const removeDescription = (index: number) => {
    setFormData(prev => ({
      ...prev,
      descriptions: prev.descriptions.filter((_, i) => i !== index),
    }));
  };

  const updateDescription = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      descriptions: prev.descriptions.map((d, i) => (i === index ? value : d)),
    }));
  };

  const displayOrderOptions = Array.from(
    { length: Math.max(existingPlansCount + 1, 10) },
    (_, i) => i + 1
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {isCreating ? "Create New Service Plan" : "Edit Service Plan"}
            </h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-4 space-y-6">
            {/* General Section */}
            <div className="bg-gray-100 px-4 py-2 -mx-6 font-medium text-gray-700">
              General
            </div>

            {/* Service Plan Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Please Select Service Plan Type *
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="planType"
                    value="SERVICE"
                    checked={formData.type === "SERVICE"}
                    onChange={() => setFormData(prev => ({ ...prev, type: "SERVICE" }))}
                    className="w-4 h-4 text-teal-600"
                  />
                  <span className="text-sm text-gray-700">Service</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="planType"
                    value="PRODUCT"
                    checked={formData.type === "PRODUCT"}
                    onChange={() => setFormData(prev => ({ ...prev, type: "PRODUCT" }))}
                    className="w-4 h-4 text-teal-600"
                  />
                  <span className="text-sm text-gray-700">Product</span>
                </label>
              </div>
            </div>

            {/* Service Plan Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Plan Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Service Plan Name"
              />
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mt-2 text-sm text-blue-700 flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">💡</span>
                <span>Ensure service plan names are consistent in length for optimal display</span>
              </div>
            </div>

            {/* Cleanup Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cleanup Frequency *
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {FREQUENCY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  value={priceInput}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  onBlur={handlePriceBlur}
                  required
                  className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Billing Interval */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Default Billing Interval
              </label>
              <select
                value={formData.billingInterval}
                onChange={(e) => setFormData(prev => ({ ...prev, billingInterval: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {BILLING_INTERVALS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Billing Option */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">
                Default Billing Option
              </label>
              <select
                value={formData.billingOption}
                onChange={(e) => setFormData(prev => ({ ...prev, billingOption: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {BILLING_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Taxable */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.taxable}
                onChange={(e) => setFormData(prev => ({ ...prev, taxable: e.target.checked }))}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Taxable</span>
            </label>

            {/* Display Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Plan Order of Display *
              </label>
              <select
                value={formData.displayOrder}
                onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: Number(e.target.value) }))}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {displayOrderOptions.map(order => (
                  <option key={order} value={order}>{order}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">The order is displayed from left to right</p>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mt-2 text-sm text-blue-700 flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">💡</span>
                <span>Ensure that multiple service plans are not assigned to the same display position. If they are, only the service plan created first will be displayed.</span>
              </div>
            </div>

            {/* Featured */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => setFormData(prev => ({ ...prev, isFeatured: e.target.checked }))}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Set service plan as featured</span>
            </label>

            {/* Featured Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Featured Label
              </label>
              <input
                type="text"
                value={formData.featuredLabel}
                onChange={(e) => setFormData(prev => ({ ...prev, featuredLabel: e.target.value.slice(0, 20) }))}
                maxLength={20}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Featured Label"
              />
              <p className="text-xs text-gray-500 mt-1 text-right">{formData.featuredLabel.length} / 20</p>
            </div>

            {/* Descriptions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descriptions
              </label>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-3 text-sm text-yellow-800">
                The descriptions will be displayed in bullet points.<br />
                Leave field blank if you don&apos;t want to show descriptions
              </div>

              <div className="space-y-2">
                {formData.descriptions.map((desc, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={desc}
                      onChange={(e) => updateDescription(index, e.target.value)}
                      placeholder={`Description #${index + 1}`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeDescription(index)}
                      className="p-2 text-red-500 hover:text-red-700"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addDescription}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <Plus className="w-4 h-4" />
                ADD NEW DESCRIPTION
              </button>
            </div>

            {/* Styling Section */}
            <div className="bg-gray-100 px-4 py-2 -mx-6 font-medium text-gray-700">
              Styling
            </div>

            {/* Button Color */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">Button Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.buttonColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, buttonColor: e.target.value }))}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.buttonColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, buttonColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Background Color */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">Background Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.backgroundColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.backgroundColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, backgroundColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Featured Color */}
            <div>
              <label className="block text-sm text-gray-500 mb-1">Featured Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.featuredColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, featuredColor: e.target.value }))}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.featuredColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, featuredColor: e.target.value }))}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-700 text-sm">
                {saveError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name}
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
