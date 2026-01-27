"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, Calendar, Clock, User } from "lucide-react";

interface UnassignedSubscription {
  id: string;
  clientId: string;
  clientName: string;
  locationId: string;
  address: string;
  city: string;
  zipCode: string;
  planName: string | null;
  frequency: string;
  signUpDate: string;
  hasPaymentMethod: boolean;
  needsInitialCleanup: boolean;
  needsRouteAssignment: boolean;
}

interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AssignmentModalProps {
  subscription: UnassignedSubscription;
  onClose: () => void;
  onSave: () => void;
}

const DAYS_OF_WEEK = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
];

export function AssignmentModal({ subscription, onClose, onSave }: AssignmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);

  // Form state
  const [scheduleInitialCleanup, setScheduleInitialCleanup] = useState(subscription.needsInitialCleanup);
  const [initialCleanupDate, setInitialCleanupDate] = useState("");
  const [initialCleanupTechId, setInitialCleanupTechId] = useState("");
  const [initialCleanupMinutes, setInitialCleanupMinutes] = useState(30);

  const [recurringStartDate, setRecurringStartDate] = useState("");
  const [recurringServiceDays, setRecurringServiceDays] = useState<string[]>([]);
  const [recurringTechId, setRecurringTechId] = useState("");
  const [recurringMinutes, setRecurringMinutes] = useState(15);

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/staff?role=FIELD_TECH,CREW_LEAD&status=active");
      const data = await res.json();
      if (res.ok) {
        setStaff(data.staff || []);
      }
    } catch (err) {
      console.error("Error fetching staff:", err);
    } finally {
      setLoading(false);
    }
  }

  function toggleServiceDay(day: string) {
    if (recurringServiceDays.includes(day)) {
      setRecurringServiceDays(recurringServiceDays.filter((d) => d !== day));
    } else {
      setRecurringServiceDays([...recurringServiceDays, day]);
    }
  }

  async function handleSave() {
    setError(null);

    // Validation
    if (!recurringStartDate) {
      setError("Regular service start date is required");
      return;
    }
    if (recurringServiceDays.length === 0) {
      setError("At least one service day is required");
      return;
    }
    if (!recurringTechId) {
      setError("Field tech is required for recurring service");
      return;
    }

    if (scheduleInitialCleanup) {
      if (!initialCleanupDate) {
        setError("Initial cleanup date is required");
        return;
      }
      if (!initialCleanupTechId) {
        setError("Tech is required for initial cleanup");
        return;
      }
    }

    setSaving(true);
    try {
      const body: {
        subscriptionId: string;
        initialCleanup?: {
          date: string;
          techId: string;
          estimatedMinutes: number;
        };
        recurringService: {
          startDate: string;
          serviceDays: string[];
          techId: string;
          estimatedMinutes: number;
        };
      } = {
        subscriptionId: subscription.id,
        recurringService: {
          startDate: recurringStartDate,
          serviceDays: recurringServiceDays,
          techId: recurringTechId,
          estimatedMinutes: recurringMinutes,
        },
      };

      if (scheduleInitialCleanup) {
        body.initialCleanup = {
          date: initialCleanupDate,
          techId: initialCleanupTechId,
          estimatedMinutes: initialCleanupMinutes,
        };
      }

      const res = await fetch("/api/admin/unassigned-subscriptions/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        onSave();
        onClose();
      } else {
        setError(data.error || "Failed to save assignment");
      }
    } catch (err) {
      console.error("Error saving assignment:", err);
      setError("Failed to save assignment");
    } finally {
      setSaving(false);
    }
  }

  function formatFrequency(freq: string) {
    const labels: Record<string, string> = {
      TWICE_WEEKLY: "Twice Weekly",
      WEEKLY: "Weekly",
      BIWEEKLY: "Bi-weekly",
      MONTHLY: "Monthly",
      ONETIME: "One-time",
    };
    return labels[freq] || freq;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">Assign Service</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Client Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900">{subscription.clientName}</p>
            <p className="text-sm text-gray-600">
              {subscription.planName || formatFrequency(subscription.frequency)} Cleanup
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {subscription.address}, {subscription.city} {subscription.zipCode}
            </p>
          </div>

          {/* Warning Banners */}
          {!subscription.hasPaymentMethod && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Missing payment method
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Initial Cleanup Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-600" />
                Initial Cleanup
              </h3>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleInitialCleanup}
                  onChange={(e) => setScheduleInitialCleanup(e.target.checked)}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                Schedule
              </label>
            </div>

            {scheduleInitialCleanup && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Date</label>
                  <input
                    type={initialCleanupDate ? "date" : "text"}
                    value={initialCleanupDate}
                    onChange={(e) => setInitialCleanupDate(e.target.value)}
                    onFocus={(e) => (e.target.type = "date")}
                    onBlur={(e) => { if (!initialCleanupDate) e.target.type = "text"; }}
                    placeholder="Select date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Tech</label>
                  <select
                    value={initialCleanupTechId}
                    onChange={(e) => setInitialCleanupTechId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="">Select tech...</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Est. Time</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={initialCleanupMinutes}
                      onChange={(e) => setInitialCleanupMinutes(parseInt(e.target.value) || 30)}
                      min={5}
                      step={5}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                    <span className="text-sm text-gray-600">min</span>
                  </div>
                </div>
              </div>
            )}

            {!scheduleInitialCleanup && (
              <p className="text-sm text-gray-500">
                {subscription.needsInitialCleanup
                  ? "Check the box to schedule an initial cleanup visit"
                  : "No initial cleanup required for this subscription"}
              </p>
            )}
          </div>

          {/* Recurring Service Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              Recurring Service
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Regular Service Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type={recurringStartDate ? "date" : "text"}
                  value={recurringStartDate}
                  onChange={(e) => setRecurringStartDate(e.target.value)}
                  onFocus={(e) => (e.target.type = "date")}
                  onBlur={(e) => { if (!recurringStartDate) e.target.type = "text"; }}
                  placeholder="Select date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Service Days <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleServiceDay(day.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        recurringServiceDays.includes(day.value)
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-teal-500"
                      }`}
                    >
                      {day.label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Field Tech <span className="text-red-500">*</span>
                </label>
                <select
                  value={recurringTechId}
                  onChange={(e) => setRecurringTechId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Select tech...</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">Est. Time</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={recurringMinutes}
                    onChange={(e) => setRecurringMinutes(parseInt(e.target.value) || 15)}
                    min={5}
                    step={5}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <span className="text-sm text-gray-600">min</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium"
          >
            {saving ? "Saving..." : "Save Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
