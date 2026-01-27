"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  MapPin,
  ArrowRight,
  Calendar,
  Clock,
  Loader2,
  ChevronLeft,
} from "lucide-react";

interface Suggestion {
  id: string;
  subscriptionId: string | null;
  suggestionType: string;
  currentState: {
    day?: string;
    techId?: string;
    clientName?: string;
    address?: string;
  };
  suggestedState: {
    day?: string;
    techId?: string;
    techName?: string;
  };
  reasoning: string;
  timeImpactMinutes: number | null;
  status: string;
  createdAt: string;
  clientName: string;
  address: string;
}

interface LastAnalysis {
  completedAt: string;
  runType: string;
  suggestionsGenerated: number;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

export default function SuggestionsPage() {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<LastAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/route-planner/suggestions");
      const data = await res.json();

      if (res.ok) {
        setSuggestions(data.suggestions || []);
        setLastAnalysis(data.lastAnalysis);
      } else {
        setError(data.error || "Failed to load suggestions");
      }
    } catch (err) {
      console.error("Error fetching suggestions:", err);
      setError("Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/route-planner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisType: "continuous_check",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Refresh suggestions after analysis
        fetchSuggestions();
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch (err) {
      console.error("Error running analysis:", err);
      setError("Failed to run analysis");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAction = async (suggestionId: string, action: "accept" | "dismiss") => {
    setProcessingId(suggestionId);
    try {
      const res = await fetch("/api/admin/route-planner/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, action }),
      });

      if (res.ok) {
        // Remove the processed suggestion from the list
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      } else {
        const data = await res.json();
        setError(data.error || `Failed to ${action} suggestion`);
      }
    } catch (err) {
      console.error(`Error ${action}ing suggestion:`, err);
      setError(`Failed to ${action} suggestion`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/app/office/route-planner"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Route Optimization Suggestions
            </h1>
            <p className="text-gray-600">
              AI-generated recommendations to improve route efficiency
            </p>
          </div>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 font-medium"
        >
          {analyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {analyzing ? "Analyzing..." : "Run Analysis Now"}
        </button>
      </div>

      {/* Last Analysis Info */}
      {lastAnalysis && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          Last analysis: {formatRelativeTime(lastAnalysis.completedAt)}
          {lastAnalysis.suggestionsGenerated > 0 && (
            <span className="text-gray-400">
              ({lastAnalysis.suggestionsGenerated} suggestion
              {lastAnalysis.suggestionsGenerated !== 1 ? "s" : ""} generated)
            </span>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Suggestions List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="mt-3 text-gray-500">Loading suggestions...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">No pending suggestions</p>
            <p className="text-gray-400 text-sm mt-1">
              Run an analysis to check for optimization opportunities
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {suggestion.clientName || "Unknown Client"}
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {suggestion.address || "Address unavailable"}
                        </p>
                      </div>

                      {/* Time savings badge */}
                      {suggestion.timeImpactMinutes && suggestion.timeImpactMinutes > 0 && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full whitespace-nowrap">
                          Save ~{suggestion.timeImpactMinutes} min/week
                        </span>
                      )}
                    </div>

                    {/* Move indicator */}
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded font-medium">
                        {DAY_LABELS[suggestion.currentState.day || ""] || "Not set"}
                      </span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">
                        {DAY_LABELS[suggestion.suggestedState.day || ""] || "Unknown"}
                      </span>
                      {suggestion.suggestedState.techName && (
                        <span className="text-gray-500">
                          with {suggestion.suggestedState.techName}
                        </span>
                      )}
                    </div>

                    {/* Reasoning */}
                    <p className="mt-2 text-sm text-gray-600">{suggestion.reasoning}</p>

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleAction(suggestion.id, "accept")}
                        disabled={processingId === suggestion.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {processingId === suggestion.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => handleAction(suggestion.id, "dismiss")}
                        disabled={processingId === suggestion.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Refresh */}
      {!loading && suggestions.length > 0 && (
        <div className="text-center">
          <button
            onClick={fetchSuggestions}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh suggestions
          </button>
        </div>
      )}
    </div>
  );
}
