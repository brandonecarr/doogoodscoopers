"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MoreVertical, Calendar, Eye, Pencil, X, ArrowUpDown } from "lucide-react";

interface PayrollSettings {
  mileageRateCents: number;
  hourlyRateCents: number;
  basePercentage: number;
  yardRateCents: number;
  fixedRateCents: number;
  minRevenuePerMile: number | null;
  minRevenuePerHour: number | null;
  affectingCompanyAverages: boolean | null;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string | null;
  staff_profile?: {
    hire_date: string | null;
    hourly_rate_cents: number | null;
  } | null;
  payroll?: PayrollSettings;
}

interface PayrollVisibility {
  yearsInService: boolean;
  residentialRevenue: boolean;
  commercialRevenue: boolean;
  revenue: boolean;
  distance: boolean;
  overtimeHours: boolean;
  vacationHours: boolean;
  tips: boolean;
  miscReimb: boolean;
  nrOfJobs: boolean;
  mileageRate: boolean;
  basePercentage: boolean;
  fixedRate: boolean;
  workedHours: boolean;
  additionalResidentialServicesRevenue: boolean;
  additionalCommercialServicesRevenue: boolean;
  revenueAdjustment: boolean;
  regularHours: boolean;
  holidayHours: boolean;
  pto: boolean;
  addlBonus: boolean;
  deductions: boolean;
  nrOfComplaints: boolean;
  hourlyRate: boolean;
  perYardRate: boolean;
}

const DEFAULT_VISIBILITY: PayrollVisibility = {
  yearsInService: true,
  residentialRevenue: true,
  commercialRevenue: true,
  revenue: true,
  distance: true,
  overtimeHours: true,
  vacationHours: true,
  tips: true,
  miscReimb: true,
  nrOfJobs: true,
  mileageRate: true,
  basePercentage: true,
  fixedRate: true,
  workedHours: true,
  additionalResidentialServicesRevenue: true,
  additionalCommercialServicesRevenue: true,
  revenueAdjustment: true,
  regularHours: true,
  holidayHours: true,
  pto: true,
  addlBonus: true,
  deductions: true,
  nrOfComplaints: true,
  hourlyRate: true,
  perYardRate: true,
};

interface OrgSettings {
  payroll?: {
    payPeriod: "weekly" | "biweekly" | "monthly";
    payPeriodStartDay: number; // 0-6 for day of week
    showPayrollOnFieldTechApp: boolean;
    staffPayroll: Record<string, PayrollSettings>;
    visibility?: PayrollVisibility;
  };
}

type SortField = "lastName" | "firstName" | "hireDate" | "yearsInService";
type SortDirection = "asc" | "desc";

// Toggle Switch Component
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
        checked ? "bg-teal-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Visibility Checkbox Component
function VisibilityCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
            checked ? "bg-teal-600" : "bg-white border-2 border-gray-300"
          }`}
        >
          {checked && (
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export default function PayrollSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [settings, setSettings] = useState<OrgSettings["payroll"]>({
    payPeriod: "weekly",
    payPeriodStartDay: 1, // Monday
    showPayrollOnFieldTechApp: false,
    staffPayroll: {},
  });
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("lastName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFieldTechModal, setShowFieldTechModal] = useState(false);
  const [showPayPeriodModal, setShowPayPeriodModal] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Modal form states
  const [tempShowPayroll, setTempShowPayroll] = useState(false);
  const [tempPayPeriod, setTempPayPeriod] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [tempPayPeriodStartDay, setTempPayPeriodStartDay] = useState(1);
  const [tempVisibility, setTempVisibility] = useState<PayrollVisibility>(DEFAULT_VISIBILITY);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch staff and settings in parallel
      const [staffRes, settingsRes] = await Promise.all([
        fetch("/api/admin/staff?role=FIELD_TECH"),
        fetch("/api/admin/settings"),
      ]);

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaff(staffData.staff || []);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const payrollSettings = settingsData.settings?.payroll || {};
        setSettings({
          payPeriod: payrollSettings.payPeriod || "weekly",
          payPeriodStartDay: payrollSettings.payPeriodStartDay ?? 1,
          showPayrollOnFieldTechApp: payrollSettings.showPayrollOnFieldTechApp ?? false,
          staffPayroll: payrollSettings.staffPayroll || {},
          visibility: payrollSettings.visibility || DEFAULT_VISIBILITY,
        });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate years in service
  const calculateYearsInService = (hireDate: string | null) => {
    if (!hireDate) return null;
    const hire = new Date(hireDate);
    const now = new Date();
    const years = now.getFullYear() - hire.getFullYear();
    const months = now.getMonth() - hire.getMonth();
    const totalMonths = years * 12 + months;
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    return { years: y, months: m, display: `${y}y, ${m}m` };
  };

  // Get payroll settings for a staff member
  const getPayrollSettings = (staffId: string): PayrollSettings => {
    return settings?.staffPayroll?.[staffId] || {
      mileageRateCents: 0,
      hourlyRateCents: 0,
      basePercentage: 0,
      yardRateCents: 0,
      fixedRateCents: 0,
      minRevenuePerMile: null,
      minRevenuePerHour: null,
      affectingCompanyAverages: null,
    };
  };

  // Format currency
  const formatCurrency = (cents: number | null | undefined, suffix: string) => {
    if (cents === null || cents === undefined) return "No data";
    return `$${(cents / 100).toFixed(2)} / ${suffix}`;
  };

  // Format percentage
  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "No data";
    return `${value.toFixed(2)}%`;
  };

  // Sort staff
  const sortedStaff = [...staff].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "lastName":
        comparison = (a.last_name || "").localeCompare(b.last_name || "");
        break;
      case "firstName":
        comparison = (a.first_name || "").localeCompare(b.first_name || "");
        break;
      case "hireDate":
        const aDate = a.staff_profile?.hire_date || "";
        const bDate = b.staff_profile?.hire_date || "";
        comparison = aDate.localeCompare(bDate);
        break;
      case "yearsInService":
        const aYears = calculateYearsInService(a.staff_profile?.hire_date || null);
        const bYears = calculateYearsInService(b.staff_profile?.hire_date || null);
        const aMonths = aYears ? aYears.years * 12 + aYears.months : 0;
        const bMonths = bYears ? bYears.years * 12 + bYears.months : 0;
        comparison = aMonths - bMonths;
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedStaff.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStaff = sortedStaff.slice(startIndex, endIndex);

  // Get pay period display text
  const getPayPeriodDisplay = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    const dayName = days[settings?.payPeriodStartDay || 1];
    const periodLabel = settings?.payPeriod === "weekly" ? "Weekly" :
                       settings?.payPeriod === "biweekly" ? "Bi-Weekly" : "Monthly";
    return `Please update pay rates starting on ${dayName} ${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-${String(today.getFullYear()).slice(-2)} (Pay period: ${periodLabel})`;
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Save field tech app settings
  const saveFieldTechSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            payroll: {
              ...settings,
              showPayrollOnFieldTechApp: tempShowPayroll,
            },
          },
        }),
      });

      if (res.ok) {
        setSettings((prev) => prev ? { ...prev, showPayrollOnFieldTechApp: tempShowPayroll } : prev);
        setShowFieldTechModal(false);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  // Save pay period settings
  const savePayPeriodSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            payroll: {
              ...settings,
              payPeriod: tempPayPeriod,
              payPeriodStartDay: tempPayPeriodStartDay,
            },
          },
        }),
      });

      if (res.ok) {
        setSettings((prev) => prev ? {
          ...prev,
          payPeriod: tempPayPeriod,
          payPeriodStartDay: tempPayPeriodStartDay,
        } : prev);
        setShowPayPeriodModal(false);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  // Open field tech modal
  const openFieldTechModal = () => {
    setTempShowPayroll(settings?.showPayrollOnFieldTechApp || false);
    setShowFieldTechModal(true);
    setMenuOpen(false);
  };

  // Open pay period modal
  const openPayPeriodModal = () => {
    setTempPayPeriod(settings?.payPeriod || "weekly");
    setTempPayPeriodStartDay(settings?.payPeriodStartDay ?? 1);
    setShowPayPeriodModal(true);
    setMenuOpen(false);
  };

  // Open visibility modal
  const openVisibilityModal = () => {
    setTempVisibility(settings?.visibility || DEFAULT_VISIBILITY);
    setShowVisibilityModal(true);
    setMenuOpen(false);
  };

  // Save visibility settings
  const saveVisibilitySettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            payroll: {
              ...settings,
              visibility: tempVisibility,
            },
          },
        }),
      });

      if (res.ok) {
        setSettings((prev) => prev ? { ...prev, visibility: tempVisibility } : prev);
        setShowVisibilityModal(false);
      }
    } catch (error) {
      console.error("Error saving visibility settings:", error);
    } finally {
      setSaving(false);
    }
  };

  // Reset visibility to default
  const resetVisibilityToDefault = () => {
    setTempVisibility(DEFAULT_VISIBILITY);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
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
        <span className="text-gray-400">PAYROLL</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">{getPayPeriodDisplay()}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 3-dot menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={openVisibilityModal}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <Eye className="w-4 h-4" />
                    Show/Hide Payroll Info
                  </button>
                  <button
                    onClick={openPayPeriodModal}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                  >
                    <Calendar className="w-4 h-4" />
                    Edit Pay Period
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={openFieldTechModal}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700"
          >
            EDIT FIELDTECH APP SETTINGS
          </button>
        </div>
      </div>

      {/* Staff Table */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  <button
                    onClick={() => handleSort("lastName")}
                    className="flex items-center gap-1 hover:text-gray-700"
                  >
                    Last Name
                    {sortField === "lastName" && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">First Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Hire Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Years in Service<br /><span className="font-normal">(year/month)</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Mileage Rate<br /><span className="font-normal">($/mi)</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Hourly Rate<br /><span className="font-normal">($/hr)</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Base Percentage<br /><span className="font-normal">(%)</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Yard Rate<br /><span className="font-normal">($/yard)</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Fixed Rate<br /><span className="font-normal">($/pay period)</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Min revenue<br /><span className="font-normal">per mile ($)</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Min revenue<br /><span className="font-normal">per hour ($)</span>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">
                  Affecting<br />company<br />averages
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStaff.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-gray-500">
                    No staff members found
                  </td>
                </tr>
              ) : (
                paginatedStaff.map((member) => {
                  const payroll = getPayrollSettings(member.id);
                  const yearsInService = calculateYearsInService(member.staff_profile?.hire_date || null);
                  return (
                    <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-teal-600">{member.last_name || "—"}</td>
                      <td className="py-3 px-4 text-sm text-teal-600">{member.first_name}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {member.staff_profile?.hire_date || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {yearsInService?.display || "—"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {formatCurrency(payroll.mileageRateCents, "mi.")}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {formatCurrency(payroll.hourlyRateCents, "hr.")}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {formatPercentage(payroll.basePercentage)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {formatCurrency(payroll.yardRateCents, "yard")}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {formatCurrency(payroll.fixedRateCents, settings?.payPeriod === "weekly" ? "week" : settings?.payPeriod === "biweekly" ? "2 weeks" : "month")}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400 italic">
                        {payroll.minRevenuePerMile !== null ? `$${payroll.minRevenuePerMile.toFixed(2)}` : "No data"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400 italic">
                        {payroll.minRevenuePerHour !== null ? `$${payroll.minRevenuePerHour.toFixed(2)}` : "No data"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400 italic">
                        {payroll.affectingCompanyAverages !== null
                          ? (payroll.affectingCompanyAverages ? "Yes" : "No")
                          : "No data"}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => setEditingStaff(member)}
                          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium"
                        >
                          Edit
                          <Pencil className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
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
            {sortedStaff.length === 0
              ? "0-0"
              : `${startIndex + 1}-${Math.min(endIndex, sortedStaff.length)}`}{" "}
            of {sortedStaff.length}
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

      {/* Edit Fieldtech App Settings Modal */}
      {showFieldTechModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowFieldTechModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900">Edit Fieldtech App Settings</h3>
              </div>
              <div className="px-6 pb-6">
                <div className="flex items-center gap-4">
                  <Toggle checked={tempShowPayroll} onChange={setTempShowPayroll} />
                  <span className="text-sm text-gray-700">Show Payroll on Fieldtech App</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 pb-6">
                <button
                  onClick={() => setShowFieldTechModal(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800"
                >
                  CANCEL
                </button>
                <button
                  onClick={saveFieldTechSettings}
                  disabled={saving}
                  className="px-4 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "SAVING..." : "SAVE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Pay Period Modal */}
      {showPayPeriodModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowPayPeriodModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900">Edit Pay Period</h3>
              </div>
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-2">Pay Period</label>
                  <select
                    value={tempPayPeriod}
                    onChange={(e) => setTempPayPeriod(e.target.value as "weekly" | "biweekly" | "monthly")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-2">Pay Period Start Day</label>
                  <select
                    value={tempPayPeriodStartDay}
                    onChange={(e) => setTempPayPeriodStartDay(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 pb-6">
                <button
                  onClick={() => setShowPayPeriodModal(false)}
                  className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800"
                >
                  CANCEL
                </button>
                <button
                  onClick={savePayPeriodSettings}
                  disabled={saving}
                  className="px-4 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "SAVING..." : "SAVE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show/Hide Payroll Info Modal */}
      {showVisibilityModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowVisibilityModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl">
              <div className="p-6 pb-4">
                <h3 className="text-lg font-semibold text-gray-900">Show/Hide Payroll Info</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Please hide information that you do not use. Your changes will be applied to all payroll views for all staff.
                </p>
              </div>
              <div className="px-6 pb-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  {/* Left Column */}
                  <div className="space-y-3">
                    <VisibilityCheckbox
                      label="Years in Service"
                      checked={tempVisibility.yearsInService}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, yearsInService: checked })}
                    />
                    <VisibilityCheckbox
                      label="Residential Revenue"
                      checked={tempVisibility.residentialRevenue}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, residentialRevenue: checked })}
                    />
                    <VisibilityCheckbox
                      label="Commercial Revenue"
                      checked={tempVisibility.commercialRevenue}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, commercialRevenue: checked })}
                    />
                    <VisibilityCheckbox
                      label="Revenue"
                      checked={tempVisibility.revenue}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, revenue: checked })}
                    />
                    <VisibilityCheckbox
                      label="Distance"
                      checked={tempVisibility.distance}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, distance: checked })}
                    />
                    <VisibilityCheckbox
                      label="Overtime Hours"
                      checked={tempVisibility.overtimeHours}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, overtimeHours: checked })}
                    />
                    <VisibilityCheckbox
                      label="Vacation Hours"
                      checked={tempVisibility.vacationHours}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, vacationHours: checked })}
                    />
                    <VisibilityCheckbox
                      label="Tips"
                      checked={tempVisibility.tips}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, tips: checked })}
                    />
                    <VisibilityCheckbox
                      label="Msc Reimb"
                      checked={tempVisibility.miscReimb}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, miscReimb: checked })}
                    />
                    <VisibilityCheckbox
                      label="Nr of Jobs"
                      checked={tempVisibility.nrOfJobs}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, nrOfJobs: checked })}
                    />
                    <VisibilityCheckbox
                      label="Mileage Rate"
                      checked={tempVisibility.mileageRate}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, mileageRate: checked })}
                    />
                    <VisibilityCheckbox
                      label="Base Percentage"
                      checked={tempVisibility.basePercentage}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, basePercentage: checked })}
                    />
                    <VisibilityCheckbox
                      label="Fixed Rate"
                      checked={tempVisibility.fixedRate}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, fixedRate: checked })}
                    />
                  </div>
                  {/* Right Column */}
                  <div className="space-y-3">
                    <VisibilityCheckbox
                      label="Worked Hours"
                      checked={tempVisibility.workedHours}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, workedHours: checked })}
                    />
                    <VisibilityCheckbox
                      label="Additional Residential Services Revenue"
                      checked={tempVisibility.additionalResidentialServicesRevenue}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, additionalResidentialServicesRevenue: checked })}
                    />
                    <VisibilityCheckbox
                      label="Additional Commercial Services Revenue"
                      checked={tempVisibility.additionalCommercialServicesRevenue}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, additionalCommercialServicesRevenue: checked })}
                    />
                    <VisibilityCheckbox
                      label="Revenue Adjustment"
                      checked={tempVisibility.revenueAdjustment}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, revenueAdjustment: checked })}
                    />
                    <VisibilityCheckbox
                      label="Regular Hours"
                      checked={tempVisibility.regularHours}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, regularHours: checked })}
                    />
                    <VisibilityCheckbox
                      label="Holiday Hours"
                      checked={tempVisibility.holidayHours}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, holidayHours: checked })}
                    />
                    <VisibilityCheckbox
                      label="PTO"
                      checked={tempVisibility.pto}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, pto: checked })}
                    />
                    <VisibilityCheckbox
                      label="Addl Bonus"
                      checked={tempVisibility.addlBonus}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, addlBonus: checked })}
                    />
                    <VisibilityCheckbox
                      label="Deductions"
                      checked={tempVisibility.deductions}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, deductions: checked })}
                    />
                    <VisibilityCheckbox
                      label="Nr of Complaints"
                      checked={tempVisibility.nrOfComplaints}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, nrOfComplaints: checked })}
                    />
                    <VisibilityCheckbox
                      label="Hourly Rate"
                      checked={tempVisibility.hourlyRate}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, hourlyRate: checked })}
                    />
                    <VisibilityCheckbox
                      label="Per Yard Rate"
                      checked={tempVisibility.perYardRate}
                      onChange={(checked) => setTempVisibility({ ...tempVisibility, perYardRate: checked })}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between px-6 pb-6">
                <button
                  onClick={resetVisibilityToDefault}
                  className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                >
                  Reset To Default
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowVisibilityModal(false)}
                    className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={saveVisibilitySettings}
                    disabled={saving}
                    className="px-4 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
                  >
                    {saving ? "SAVING..." : "SAVE"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Payroll Modal */}
      {editingStaff && (
        <EditStaffPayrollModal
          staff={editingStaff}
          payroll={getPayrollSettings(editingStaff.id)}
          payPeriod={settings?.payPeriod || "weekly"}
          onClose={() => setEditingStaff(null)}
          onSave={async (updatedPayroll) => {
            try {
              const newStaffPayroll = {
                ...settings?.staffPayroll,
                [editingStaff.id]: updatedPayroll,
              };
              const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  settings: {
                    payroll: {
                      ...settings,
                      staffPayroll: newStaffPayroll,
                    },
                  },
                }),
              });

              if (res.ok) {
                setSettings((prev) => prev ? { ...prev, staffPayroll: newStaffPayroll } : prev);
                setEditingStaff(null);
              }
            } catch (error) {
              console.error("Error saving payroll:", error);
              throw error;
            }
          }}
        />
      )}
    </div>
  );
}

interface EditStaffPayrollModalProps {
  staff: StaffMember;
  payroll: PayrollSettings;
  payPeriod: "weekly" | "biweekly" | "monthly";
  onClose: () => void;
  onSave: (payroll: PayrollSettings) => Promise<void>;
}

function EditStaffPayrollModal({ staff, payroll, payPeriod, onClose, onSave }: EditStaffPayrollModalProps) {
  const [formData, setFormData] = useState({
    mileageRate: payroll.mileageRateCents ? (payroll.mileageRateCents / 100).toFixed(2) : "0.00",
    hourlyRate: payroll.hourlyRateCents ? (payroll.hourlyRateCents / 100).toFixed(2) : "0.00",
    basePercentage: payroll.basePercentage?.toFixed(2) || "0.00",
    yardRate: payroll.yardRateCents ? (payroll.yardRateCents / 100).toFixed(2) : "0.00",
    fixedRate: payroll.fixedRateCents ? (payroll.fixedRateCents / 100).toFixed(2) : "0.00",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        mileageRateCents: Math.round(parseFloat(formData.mileageRate) * 100),
        hourlyRateCents: Math.round(parseFloat(formData.hourlyRate) * 100),
        basePercentage: parseFloat(formData.basePercentage),
        yardRateCents: Math.round(parseFloat(formData.yardRate) * 100),
        fixedRateCents: Math.round(parseFloat(formData.fixedRate) * 100),
        minRevenuePerMile: payroll.minRevenuePerMile,
        minRevenuePerHour: payroll.minRevenuePerHour,
        affectingCompanyAverages: payroll.affectingCompanyAverages,
      });
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setSaving(false);
    }
  };

  const payPeriodLabel = payPeriod === "weekly" ? "week" : payPeriod === "biweekly" ? "2 weeks" : "month";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Payroll - {staff.first_name} {staff.last_name}
              </h3>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Mileage Rate */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">Mileage Rate ($/mi)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={formData.mileageRate}
                    onChange={(e) => setFormData({ ...formData, mileageRate: e.target.value })}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">Hourly Rate ($/hr)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Base Percentage */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">Base Percentage (%)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.basePercentage}
                    onChange={(e) => setFormData({ ...formData, basePercentage: e.target.value })}
                    className="w-full pr-8 pl-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>

              {/* Yard Rate */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">Yard Rate ($/yard)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={formData.yardRate}
                    onChange={(e) => setFormData({ ...formData, yardRate: e.target.value })}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Fixed Rate */}
              <div>
                <label className="block text-sm text-gray-500 mb-1">Fixed Rate ($/{payPeriodLabel})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="text"
                    value={formData.fixedRate}
                    onChange={(e) => setFormData({ ...formData, fixedRate: e.target.value })}
                    className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white font-medium rounded-md hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "SAVING..." : "SAVE"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
