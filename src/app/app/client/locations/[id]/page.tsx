"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Location {
  id: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zipCode: string;
  gateCode: string | null;
  accessNotes: string | null;
}

export default function EditLocationPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [location, setLocation] = useState<Location | null>(null);

  const [gateCode, setGateCode] = useState("");
  const [accessNotes, setAccessNotes] = useState("");

  useEffect(() => {
    async function fetchLocation() {
      try {
        const res = await fetch("/api/client/locations");
        const data = await res.json();

        if (res.ok) {
          const loc = data.locations.find((l: Location) => l.id === locationId);
          if (loc) {
            setLocation(loc);
            setGateCode(loc.gateCode || "");
            setAccessNotes(loc.accessNotes || "");
          } else {
            setError("Location not found");
          }
        } else {
          setError(data.error || "Failed to load location");
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Failed to load location");
      } finally {
        setLoading(false);
      }
    }

    fetchLocation();
  }, [locationId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/client/locations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          gateCode: gateCode.trim() || null,
          accessNotes: accessNotes.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Location updated successfully");
        setTimeout(() => router.push("/app/client/profile"), 1500);
      } else {
        setError(data.error || "Failed to update location");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to update location");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/client/profile"
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Edit Location</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error || "Location not found"}</p>
        </div>
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
        <h1 className="text-xl font-bold text-gray-900">Edit Location</h1>
      </div>

      {/* Messages */}
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

      {/* Address Display (read-only) */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
            <MapPin className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{location.addressLine1}</p>
            {location.addressLine2 && (
              <p className="text-gray-600">{location.addressLine2}</p>
            )}
            <p className="text-gray-600">
              {location.city}, {location.state} {location.zipCode}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              To change your address, please contact us.
            </p>
          </div>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gate Code
          </label>
          <input
            type="text"
            value={gateCode}
            onChange={(e) => setGateCode(e.target.value)}
            placeholder="Enter gate code (if applicable)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Access Notes
          </label>
          <textarea
            value={accessNotes}
            onChange={(e) => setAccessNotes(e.target.value)}
            rows={4}
            placeholder="Any special instructions for accessing your yard..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
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
          "Save Changes"
        )}
      </button>
    </div>
  );
}
