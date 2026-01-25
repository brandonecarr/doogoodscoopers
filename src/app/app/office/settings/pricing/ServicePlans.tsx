"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";

interface ServicePlan {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  is_active: boolean;
  sort_order: number;
}

export default function ServicePlans() {
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<ServicePlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/service-plans");
      if (!response.ok) {
        throw new Error("Failed to fetch service plans");
      }
      const data = await response.json();
      setPlans(data.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load service plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleCreate = () => {
    setEditingPlan({
      id: "",
      name: "",
      description: "",
      frequency: "WEEKLY",
      is_active: true,
      sort_order: plans.length,
    });
    setIsCreating(true);
  };

  const handleSave = async (plan: ServicePlan) => {
    try {
      if (isCreating) {
        await fetch("/api/admin/service-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: plan.name,
            description: plan.description,
            frequency: plan.frequency,
            is_active: plan.is_active,
            sort_order: plan.sort_order,
          }),
        });
      } else {
        await fetch("/api/admin/service-plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plan),
        });
      }
      await fetchPlans();
      setEditingPlan(null);
      setIsCreating(false);
    } catch (err) {
      console.error("Error saving plan:", err);
      setError("Failed to save service plan");
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this service plan?")) return;

    try {
      await fetch(`/api/admin/service-plans?id=${planId}`, {
        method: "DELETE",
      });
      await fetchPlans();
    } catch (err) {
      console.error("Error deleting plan:", err);
      setError("Failed to delete service plan");
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      TWICE_WEEKLY: "Two Times A Week",
      WEEKLY: "Once A Week",
      BIWEEKLY: "Bi-Weekly",
      MONTHLY: "Once A Month",
      ONETIME: "One-Time",
    };
    return labels[frequency] || frequency;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Service Plans</h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage the service plans available to customers during signup.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" />
          Add Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-gray-500 mb-4">No service plans configured yet.</p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 border border-teal-600 rounded-md hover:bg-teal-50"
          >
            <Plus className="w-4 h-4" />
            Create your first plan
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="w-8"></th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Frequency</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{plan.name}</div>
                      {plan.description && (
                        <div className="text-xs text-gray-500">{plan.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-900">
                    {getFrequencyLabel(plan.frequency)}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        plan.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {plan.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingPlan(plan);
                          setIsCreating(false);
                        }}
                        className="p-1 text-teal-600 hover:text-teal-700"
                      >
                        <Pencil className="w-4 h-4" />
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create Modal */}
      {editingPlan && (
        <PlanEditModal
          plan={editingPlan}
          isCreating={isCreating}
          onClose={() => {
            setEditingPlan(null);
            setIsCreating(false);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

interface PlanEditModalProps {
  plan: ServicePlan;
  isCreating: boolean;
  onClose: () => void;
  onSave: (plan: ServicePlan) => void;
}

function PlanEditModal({ plan, isCreating, onClose, onSave }: PlanEditModalProps) {
  const [formData, setFormData] = useState(plan);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isCreating ? "Create Service Plan" : "Edit Service Plan"}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., Weekly Service"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Brief description of this plan"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="TWICE_WEEKLY">Two Times A Week</option>
              <option value="WEEKLY">Once A Week</option>
              <option value="BIWEEKLY">Bi-Weekly</option>
              <option value="MONTHLY">Once A Month</option>
              <option value="ONETIME">One-Time</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Plan is active and visible to customers
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
