"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";

interface LeadActionsProps {
  leadId: string;
  leadType: "quote" | "outofarea" | "career" | "commercial" | "adlead";
  isArchived: boolean;
}

export function LeadActions({ leadId, leadType, isArchived }: LeadActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleAction = async (action: "archive" | "unarchive" | "delete") => {
    if (action === "delete" && !showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/lead-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, leadType, action }),
      });

      if (response.ok) {
        if (action === "delete") {
          router.push("/admin/quote-leads");
        } else {
          router.refresh();
        }
      } else {
        const data = await response.json();
        alert(data.error || `Failed to ${action} lead`);
      }
    } catch {
      alert(`Failed to ${action} lead`);
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Actions</h2>

      <div className="space-y-3">
        {/* Archive/Unarchive Button */}
        <button
          onClick={() => handleAction(isArchived ? "unarchive" : "archive")}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            isArchived
              ? "bg-teal-50 text-teal-700 hover:bg-teal-100"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {isArchived ? (
            <>
              <ArchiveRestore className="w-4 h-4" />
              Restore from Archive
            </>
          ) : (
            <>
              <Archive className="w-4 h-4" />
              Archive Lead
            </>
          )}
        </button>

        {/* Delete Button */}
        {showDeleteConfirm ? (
          <div className="p-3 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-800 mb-3">
              Are you sure? This will permanently delete this lead and all its updates.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction("delete")}
                disabled={isLoading}
                className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? "Deleting..." : "Yes, Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isLoading}
                className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => handleAction("delete")}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Lead
          </button>
        )}
      </div>
    </div>
  );
}
