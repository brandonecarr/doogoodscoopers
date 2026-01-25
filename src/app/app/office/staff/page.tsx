"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  RefreshCw,
  Edit,
  UserX,
  UserCheck,
  X,
  AlertCircle,
  Clock,
  Phone,
  Mail,
  Car,
  Calendar,
  Shield,
} from "lucide-react";
import { getRoleDisplayName, getRoleColor } from "@/lib/rbac";
import type { UserRole } from "@/lib/supabase/types";

interface StaffProfile {
  id: string;
  vehicle_type: string | null;
  license_number: string | null;
  hire_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
}

interface StaffMember {
  id: string;
  email: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_clocked_in: boolean;
  last_login_at: string | null;
  created_at: string;
  staff_profile: StaffProfile | null;
}

const STAFF_ROLES: UserRole[] = [
  "OWNER",
  "MANAGER",
  "OFFICE",
  "CREW_LEAD",
  "FIELD_TECH",
  "ACCOUNTANT",
];

const VEHICLE_TYPES = ["Truck", "Van", "SUV", "Car", "Other"];

export default function StaffPage() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, clocked_in: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    email: "",
    role: "FIELD_TECH" as UserRole,
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
    profile: {
      vehicleType: "",
      licenseNumber: "",
      hireDate: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      notes: "",
    },
  });

  useEffect(() => {
    fetchStaff();
  }, [roleFilter, statusFilter]);

  async function fetchStaff() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/admin/staff?${params}`);
      const data = await res.json();

      if (res.ok) {
        setStaff(data.staff || []);
        setStats({
          total: data.total || 0,
          active: data.active || 0,
          clocked_in: data.clocked_in || 0,
        });
      } else {
        setError(data.error || "Failed to load staff");
      }
    } catch (err) {
      console.error("Error fetching staff:", err);
      setError("Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingStaff(null);
    setForm({
      email: "",
      role: "FIELD_TECH",
      firstName: "",
      lastName: "",
      phone: "",
      password: "",
      profile: {
        vehicleType: "",
        licenseNumber: "",
        hireDate: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        notes: "",
      },
    });
    setShowModal(true);
    setError(null);
  }

  function openEditModal(member: StaffMember) {
    setEditingStaff(member);
    setForm({
      email: member.email,
      role: member.role,
      firstName: member.first_name || "",
      lastName: member.last_name || "",
      phone: member.phone || "",
      password: "",
      profile: {
        vehicleType: member.staff_profile?.vehicle_type || "",
        licenseNumber: member.staff_profile?.license_number || "",
        hireDate: member.staff_profile?.hire_date || "",
        emergencyContactName: member.staff_profile?.emergency_contact_name || "",
        emergencyContactPhone: member.staff_profile?.emergency_contact_phone || "",
        notes: member.staff_profile?.notes || "",
      },
    });
    setShowModal(true);
    setError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const method = editingStaff ? "PUT" : "POST";
      const body = editingStaff
        ? {
            id: editingStaff.id,
            email: form.email,
            role: form.role,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            profile: form.profile,
          }
        : {
            email: form.email,
            role: form.role,
            firstName: form.firstName,
            lastName: form.lastName,
            phone: form.phone,
            password: form.password || undefined,
            profile: form.profile,
          };

      const res = await fetch("/api/admin/staff", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setShowModal(false);
        fetchStaff();
      } else {
        setError(data.error || "Failed to save staff member");
      }
    } catch (err) {
      console.error("Error saving staff:", err);
      setError("Failed to save staff member");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(member: StaffMember) {
    const action = member.is_active ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${action} ${member.first_name}?`)) {
      return;
    }

    try {
      if (member.is_active) {
        // Deactivate
        const res = await fetch(`/api/admin/staff?id=${member.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to deactivate");
          return;
        }
      } else {
        // Reactivate
        const res = await fetch("/api/admin/staff", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: member.id, isActive: true }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to reactivate");
          return;
        }
      }
      fetchStaff();
    } catch (err) {
      console.error("Error toggling status:", err);
      alert("Failed to update status");
    }
  }

  const filteredStaff = staff.filter(
    (s) =>
      s.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
          <p className="text-gray-600">Manage your team members and their roles</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStaff}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            <Plus className="w-4 h-4" />
            Add Staff
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-xl font-bold text-gray-900">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Clocked In Today</p>
              <p className="text-xl font-bold text-gray-900">{stats.clocked_in}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">All Roles</option>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {getRoleDisplayName(role)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No staff members found</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
            >
              Add your first staff member
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredStaff.map((member) => (
              <div
                key={member.id}
                className={`flex items-center gap-4 p-4 hover:bg-gray-50 ${
                  !member.is_active ? "opacity-60" : ""
                }`}
              >
                {/* Avatar */}
                <div className="relative">
                  <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center text-white font-medium text-lg">
                    {member.first_name?.[0] || member.email[0].toUpperCase()}
                  </div>
                  {member.is_clocked_in && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {member.first_name} {member.last_name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleColor(
                        member.role
                      )}`}
                    >
                      {getRoleDisplayName(member.role)}
                    </span>
                    {!member.is_active && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {member.email}
                    </span>
                    {member.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {member.phone}
                      </span>
                    )}
                    {member.staff_profile?.vehicle_type && (
                      <span className="flex items-center gap-1">
                        <Car className="w-3 h-3" />
                        {member.staff_profile.vehicle_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Last Login */}
                <div className="text-right text-sm">
                  <p className="text-gray-500">Last login</p>
                  <p className="text-gray-900">
                    {member.last_login_at
                      ? new Date(member.last_login_at).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(member)}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(member)}
                    className={`p-2 rounded-lg ${
                      member.is_active
                        ? "text-red-600 hover:bg-red-50"
                        : "text-green-600 hover:bg-green-50"
                    }`}
                    title={member.is_active ? "Deactivate" : "Reactivate"}
                  >
                    {member.is_active ? (
                      <UserX className="w-4 h-4" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingStaff ? "Edit Staff Member" : "Add Staff Member"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm({ ...form, firstName: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm({ ...form, lastName: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Role & Access */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Role & Access
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value as UserRole })
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                      {STAFF_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {getRoleDisplayName(role)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!editingStaff && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Temporary Password
                      </label>
                      <input
                        type="text"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        placeholder="Leave blank to auto-generate"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Field Staff Profile */}
              {["FIELD_TECH", "CREW_LEAD"].includes(form.role) && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Field Staff Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Vehicle Type
                      </label>
                      <select
                        value={form.profile.vehicleType}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            profile: { ...form.profile, vehicleType: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      >
                        <option value="">Select...</option>
                        {VEHICLE_TYPES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        License Number
                      </label>
                      <input
                        type="text"
                        value={form.profile.licenseNumber}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            profile: { ...form.profile, licenseNumber: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        Hire Date
                      </label>
                      <input
                        type="date"
                        value={form.profile.hireDate}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            profile: { ...form.profile, hireDate: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency Contact */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={form.profile.emergencyContactName}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          profile: {
                            ...form.profile,
                            emergencyContactName: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={form.profile.emergencyContactPhone}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          profile: {
                            ...form.profile,
                            emergencyContactPhone: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={form.profile.notes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      profile: { ...form.profile, notes: e.target.value },
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Internal notes about this staff member..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.email || !form.firstName}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingStaff ? "Save Changes" : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
