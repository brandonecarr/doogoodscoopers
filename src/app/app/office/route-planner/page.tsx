"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  RefreshCw,
  AlertCircle,
  Filter,
  Users,
  Calendar,
  Sparkles,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { RoutePlannerMap } from "@/components/route-planner/RoutePlannerMap";
import { AddressSearch } from "@/components/route-planner/AddressSearch";
import { AiRecommendationPanel } from "@/components/route-planner/AiRecommendationPanel";
import { GoogleMapsProvider } from "@/components/route-planner/GoogleMapsProvider";

interface MapClient {
  id: string;
  subscriptionId: string;
  clientName: string;
  address: string;
  city: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  serviceDays: string[];
  techId: string | null;
  techName: string;
  subscriptionType: string;
  frequency: string;
  pinNumber: number;
}

interface MapTech {
  id: string;
  name: string;
  color: string;
}

interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface NewClientLocation {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

interface MapDataResponse {
  clients: MapClient[];
  techs: MapTech[];
  bounds: MapBounds | null;
}

const DAYS_OF_WEEK = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
];

export default function RoutePlannerPage() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<MapClient[]>([]);
  const [techs, setTechs] = useState<MapTech[]>([]);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);

  // New client location
  const [newClientLocation, setNewClientLocation] = useState<NewClientLocation | null>(null);

  // AI analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<{
    suggestedDay: string;
    suggestedTechId: string;
    suggestedTechName: string;
    nearbyClients: Array<{ clientName: string; address: string; distance: string }>;
    reasoning: string;
  } | null>(null);

  // Fetch map data
  const fetchMapData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedDay) params.set("day", selectedDay);
      if (selectedTechId) params.set("techId", selectedTechId);

      const url = `/api/admin/route-planner/map-data${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      const data: MapDataResponse = await res.json();

      if (res.ok) {
        setClients(data.clients || []);
        setTechs(data.techs || []);
        setBounds(data.bounds);
      } else {
        setError((data as { error?: string }).error || "Failed to load map data");
      }
    } catch (err) {
      console.error("Error fetching map data:", err);
      setError("Failed to load map data");
    } finally {
      setLoading(false);
    }
  }, [selectedDay, selectedTechId]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Handle address selection
  const handleAddressSelect = (result: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    latitude: number;
    longitude: number;
  }) => {
    setNewClientLocation({
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address,
      city: result.city,
      state: result.state,
      zipCode: result.zipCode,
    });
    setAiRecommendation(null); // Clear previous recommendation
  };

  // Handle clear address
  const handleClearAddress = () => {
    setNewClientLocation(null);
    setAiRecommendation(null);
  };

  // Run AI analysis for new client placement
  const runAiAnalysis = async () => {
    if (!newClientLocation) return;

    setAnalyzing(true);
    setAiRecommendation(null);

    try {
      const res = await fetch("/api/admin/route-planner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisType: "new_client",
          newClientLocation: {
            latitude: newClientLocation.latitude,
            longitude: newClientLocation.longitude,
            address: `${newClientLocation.address}, ${newClientLocation.city}, ${newClientLocation.state} ${newClientLocation.zipCode}`,
          },
        }),
      });

      const data = await res.json();

      if (res.ok && data.suggestions?.length > 0) {
        const suggestion = data.suggestions[0];
        setAiRecommendation({
          suggestedDay: suggestion.suggested_state?.day || "MONDAY",
          suggestedTechId: suggestion.suggested_state?.techId || "",
          suggestedTechName: suggestion.suggested_state?.techName || "Unassigned",
          nearbyClients: suggestion.suggested_state?.nearbyClients || [],
          reasoning: suggestion.reasoning || "",
        });
      }
    } catch (err) {
      console.error("Error running AI analysis:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle client click on map
  const handleClientClick = (client: MapClient) => {
    // Could show more details or highlight the client
    console.log("Client clicked:", client);
  };

  return (
    <GoogleMapsProvider>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Client Planner</h1>
          <p className="text-gray-600">
            Find the best route placement for new clients
          </p>
        </div>
        <button
          onClick={fetchMapData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Address Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <MapPin className="w-4 h-4 inline mr-1" />
          New Client Address
        </label>
        <AddressSearch
          onAddressSelect={handleAddressSelect}
          onClear={handleClearAddress}
          placeholder="Enter the new client's address..."
        />
        {newClientLocation && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">
                {newClientLocation.address}
              </span>
              , {newClientLocation.city}, {newClientLocation.state}{" "}
              {newClientLocation.zipCode}
            </p>
            <button
              onClick={runAiAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 font-medium"
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {analyzing ? "Analyzing..." : "Get AI Recommendation"}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>

        {/* Day Filter */}
        <div className="relative">
          <select
            value={selectedDay || ""}
            onChange={(e) => setSelectedDay(e.target.value || null)}
            className="appearance-none pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
          >
            <option value="">All Days</option>
            {DAYS_OF_WEEK.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Tech Filter */}
        <div className="relative">
          <select
            value={selectedTechId || ""}
            onChange={(e) => setSelectedTechId(e.target.value || null)}
            className="appearance-none pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
          >
            <option value="">All Techs</option>
            {techs.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Client count */}
        <div className="text-sm text-gray-500 ml-auto">
          {clients.length} client{clients.length !== 1 ? "s" : ""} on map
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="h-[500px] flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading map data...</p>
            </div>
          </div>
        ) : (
          <RoutePlannerMap
            clients={clients}
            techs={techs}
            bounds={bounds}
            newClientLocation={
              newClientLocation
                ? {
                    latitude: newClientLocation.latitude,
                    longitude: newClientLocation.longitude,
                    address: `${newClientLocation.address}, ${newClientLocation.city}`,
                  }
                : null
            }
            selectedDay={selectedDay}
            selectedTechId={selectedTechId}
            onClientClick={handleClientClick}
          />
        )}
      </div>

      {/* AI Recommendation Panel */}
      {aiRecommendation && (
        <AiRecommendationPanel
          recommendation={aiRecommendation}
          techs={techs}
          onAccept={() => {
            // Navigate to assignment or show confirmation
            alert(`Recommendation accepted: ${aiRecommendation.suggestedDay} with ${aiRecommendation.suggestedTechName}`);
          }}
          onChooseDifferent={() => {
            setAiRecommendation(null);
          }}
        />
      )}

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Map Legend</h3>
        <div className="flex flex-wrap gap-4">
          {newClientLocation && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                NC
              </div>
              <span className="text-sm text-gray-600">New Client Location</span>
            </div>
          )}
          {techs.map((tech) => (
            <div key={tech.id} className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-full"
                style={{ backgroundColor: tech.color }}
              />
              <span className="text-sm text-gray-600">{tech.name}</span>
            </div>
          ))}
          {techs.length === 0 && !newClientLocation && (
            <span className="text-sm text-gray-400">
              No techs assigned to routes
            </span>
          )}
        </div>
      </div>
    </div>
    </GoogleMapsProvider>
  );
}
