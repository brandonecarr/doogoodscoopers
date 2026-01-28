"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Star, Check, X, Loader2 } from "lucide-react";

interface FollowupGradeProps {
  leadId: string;
  leadType: "quote" | "outofarea" | "career" | "commercial" | "adlead";
  currentFollowupDate?: string | null;
  currentGrade?: string | null;
}

const GRADES = [
  { value: "A", label: "A - Hot Lead", color: "bg-green-100 text-green-800 border-green-300" },
  { value: "B", label: "B - Good Lead", color: "bg-teal-100 text-teal-800 border-teal-300" },
  { value: "C", label: "C - Average Lead", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  { value: "D", label: "D - Low Quality", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { value: "F", label: "F - Not Viable", color: "bg-red-100 text-red-800 border-red-300" },
];

export function FollowupGrade({
  leadId,
  leadType,
  currentFollowupDate,
  currentGrade,
}: FollowupGradeProps) {
  const router = useRouter();
  const [followupDate, setFollowupDate] = useState(
    currentFollowupDate ? new Date(currentFollowupDate).toISOString().slice(0, 16) : ""
  );
  const [grade, setGrade] = useState(currentGrade || "");
  const [saving, setSaving] = useState<"followup" | "grade" | null>(null);
  const [success, setSuccess] = useState<"followup" | "grade" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFollowupSave = async () => {
    setSaving("followup");
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/update-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          leadType,
          followupDate: followupDate || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save followup date");
      }

      setSuccess("followup");
      setTimeout(() => setSuccess(null), 2000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const handleGradeSave = async (newGrade: string) => {
    setGrade(newGrade);
    setSaving("grade");
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/update-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          leadType,
          grade: newGrade || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save grade");
      }

      setSuccess("grade");
      setTimeout(() => setSuccess(null), 2000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const clearFollowup = async () => {
    setFollowupDate("");
    setSaving("followup");
    setError(null);

    try {
      const response = await fetch("/api/admin/update-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          leadType,
          followupDate: null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to clear followup date");
      }

      setSuccess("followup");
      setTimeout(() => setSuccess(null), 2000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setSaving(null);
    }
  };

  const formatFollowupDisplay = () => {
    if (!currentFollowupDate) return null;
    const date = new Date(currentFollowupDate);
    const now = new Date();
    const isOverdue = date < now;
    const isToday = date.toDateString() === now.toDateString();

    return (
      <div className={`text-sm ${isOverdue ? "text-red-600" : isToday ? "text-amber-600" : "text-gray-600"}`}>
        {isOverdue && "Overdue: "}
        {isToday && "Today: "}
        {date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      {/* Followup Scheduling */}
      <div>
        <h3 className="text-lg font-semibold text-navy-900 mb-3 flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-teal-600" />
          Schedule Followup
        </h3>

        {formatFollowupDisplay()}

        <div className="mt-3 space-y-3">
          <input
            type="datetime-local"
            value={followupDate}
            onChange={(e) => setFollowupDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />

          <div className="flex gap-2">
            <button
              onClick={handleFollowupSave}
              disabled={saving === "followup"}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {saving === "followup" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : success === "followup" ? (
                <Check className="w-4 h-4" />
              ) : (
                "Save"
              )}
            </button>

            {currentFollowupDate && (
              <button
                onClick={clearFollowup}
                disabled={saving === "followup"}
                className="px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Clear followup"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grade Selection */}
      <div>
        <h3 className="text-lg font-semibold text-navy-900 mb-3 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          Lead Grade
        </h3>

        <div className="space-y-2">
          {GRADES.map((g) => (
            <button
              key={g.value}
              onClick={() => handleGradeSave(g.value)}
              disabled={saving === "grade"}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all ${
                grade === g.value
                  ? `${g.color} border-2 font-medium`
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <span>{g.label}</span>
              {grade === g.value && saving === "grade" && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {grade === g.value && success === "grade" && (
                <Check className="w-4 h-4" />
              )}
              {grade === g.value && !saving && !success && (
                <Check className="w-4 h-4" />
              )}
            </button>
          ))}

          {grade && (
            <button
              onClick={() => handleGradeSave("")}
              disabled={saving === "grade"}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear Grade
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
