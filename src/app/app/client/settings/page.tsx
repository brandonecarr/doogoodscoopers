"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Bell, Lock, LogOut, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface NotificationPreferences {
  sms: boolean;
  email: boolean;
  dayAhead: boolean;
  onTheWay: boolean;
  completed: boolean;
}

interface Profile {
  phone: string | null;
  notificationPreferences: NotificationPreferences;
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    sms: true,
    email: true,
    dayAhead: true,
    onTheWay: true,
    completed: true,
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/client/profile");
        const data = await res.json();

        if (res.ok) {
          setPhone(data.profile.phone || "");
          setNotifications(data.profile.notificationPreferences);
        } else {
          setError(data.error || "Failed to load settings");
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/client/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          notificationPreferences: notifications,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Settings saved successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Failed to save settings");
      }
    } catch (err) {
      console.error("Error saving settings:", err);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const toggleNotification = (key: keyof NotificationPreferences) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/client/profile"
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Contact Info */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-4">Contact Information</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            placeholder="(555) 123-4567"
          />
          <p className="text-xs text-gray-500 mt-1">
            Used for service notifications
          </p>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-teal-600" />
            Notifications
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {/* Channels */}
          <div className="p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Notification Channels</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-gray-700">SMS Messages</span>
                <input
                  type="checkbox"
                  checked={notifications.sms}
                  onChange={() => toggleNotification("sms")}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Email Notifications</span>
                <input
                  type="checkbox"
                  checked={notifications.email}
                  onChange={() => toggleNotification("email")}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
              </label>
            </div>
          </div>

          {/* Notification Types */}
          <div className="p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Notification Types</p>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Day-Ahead Reminder</span>
                  <p className="text-xs text-gray-500">Reminder the day before service</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.dayAhead}
                  onChange={() => toggleNotification("dayAhead")}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">On The Way Alert</span>
                  <p className="text-xs text-gray-500">When technician is heading to you</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.onTheWay}
                  onChange={() => toggleNotification("onTheWay")}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Service Complete</span>
                  <p className="text-xs text-gray-500">Confirmation when service is done</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.completed}
                  onChange={() => toggleNotification("completed")}
                  className="w-5 h-5 text-teal-600 rounded focus:ring-teal-500"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-teal-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-teal-700 transition-colors disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save Changes
          </>
        )}
      </button>

      {/* Security & Account */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-teal-600" />
            Security & Account
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          <Link
            href="/app/client/settings/password"
            className="block p-4 hover:bg-gray-50"
          >
            <p className="font-medium text-gray-900">Change Password</p>
            <p className="text-sm text-gray-500">Update your account password</p>
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full p-4 text-left hover:bg-gray-50 flex items-center gap-2 text-red-600"
          >
            <LogOut className="w-5 h-5" />
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </div>

      {/* App Info */}
      <div className="text-center text-xs text-gray-400">
        <p>DooGoodScoopers v1.0.0</p>
      </div>
    </div>
  );
}
