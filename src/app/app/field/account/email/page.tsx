"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";

export default function ChangeEmailPage() {
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    // Validation
    if (!currentEmail || !newEmail || !confirmEmail) {
      setError("All fields are required");
      return;
    }

    if (newEmail !== confirmEmail) {
      setError("New emails do not match");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/field/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentEmail,
          newEmail,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setCurrentEmail("");
        setNewEmail("");
        setConfirmEmail("");
      } else {
        setError(data.error || "Failed to change email");
      }
    } catch (err) {
      console.error("Error changing email:", err);
      setError("Failed to change email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FieldContentCard className="mt-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Change Email</h2>
      </div>

      <div className="space-y-6">
        {/* Info Notice */}
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <p className="text-sm text-blue-700">You will need to confirm new email.</p>
        </div>

        {/* Current Email */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">Current Email*</label>
          <input
            type="email"
            value={currentEmail}
            onChange={(e) => setCurrentEmail(e.target.value)}
            placeholder="Please Enter"
            className="w-full text-gray-900 border-b-2 border-gray-300 focus:border-teal-500 outline-none py-2 bg-transparent"
          />
        </div>

        {/* New Email */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">New Email*</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Please Enter"
            className="w-full text-gray-900 border-b-2 border-gray-300 focus:border-teal-500 outline-none py-2 bg-transparent"
          />
        </div>

        {/* Confirm New Email */}
        <div>
          <label className="block text-sm text-gray-500 mb-1">Confirm New Email*</label>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Please Enter"
            className="w-full text-gray-900 border-b-2 border-gray-300 focus:border-teal-500 outline-none py-2 bg-transparent"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
            A confirmation email has been sent to your new email address.
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-4 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "SUBMITTING..." : "SUBMIT"}
        </button>
      </div>
    </FieldContentCard>
  );
}
