"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import {
  MapPin,
  X,
  ChevronDown,
  ChevronUp,
  Edit,
  Pencil,
} from "lucide-react";
import { useGoogleMaps } from "@/components/route-planner/GoogleMapsProvider";
import { calculateBounds } from "@/lib/distance-utils";

interface ScheduleItem {
  id: string;
  locationId: string;
  clientId: string;
  clientName: string;
  clientFirstName: string;
  clientLastName: string;
  address: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  assignedTo: string;
  assignedUserId: string | null;
  frequency: string;
  frequencyDisplay: string;
  preferredDay: string | null;
  pricePerVisitCents: number;
  planName: string | null;
  status: string;
  createdAt: string;
  dogCount: number;
}

interface Tech {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface ScheduleMapProps {
  schedule: ScheduleItem[];
  techs: Tech[];
  selectedTechId?: string;
  selectedFrequency?: string;
  selectedDay?: string;
  onClientClick?: (item: ScheduleItem) => void;
  onEditSchedule?: (item: ScheduleItem) => void;
  className?: string;
}

const containerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 33.6846,
  lng: -117.8265, // Irvine, CA as default
};

// Default day colors matching Sweep&Go
const DEFAULT_DAY_COLORS: Record<string, string> = {
  MONDAY: "#0AEFFF",
  TUESDAY: "#A1FF0A",
  WEDNESDAY: "#580AFF",
  THURSDAY: "#BE0AFF",
  FRIDAY: "#FF0000",
  SATURDAY: "#FF8700",
  SUNDAY: "#FEE440",
};

// LocalStorage key for custom colors
const DAY_COLORS_STORAGE_KEY = "schedule-map-day-colors";

// Unassigned/unknown day color
const unassignedColor = "#6B7280";

// Tech colors for the legend (different from day colors)
const techColors = [
  "#10B981", // emerald
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
];

// Get tech initials for pin label
function getTechInitials(name: string): string {
  if (!name || name === "Unassigned") return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Create marker icon with tech initials and day color as SVG data URI
function createInitialsMarkerIcon(
  initials: string,
  dayColor: string
): google.maps.Icon {
  const fontSize = initials.length > 2 ? 10 : 12;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
      <path fill="${dayColor}" stroke="#ffffff" stroke-width="2" d="M18 0C8.059 0 0 8.059 0 18c0 9.941 18 28 18 28s18-18.059 18-28C36 8.059 27.941 0 18 0z"/>
      <circle fill="#ffffff" cx="18" cy="16" r="11"/>
      <text x="18" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${dayColor}">${initials}</text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(36, 46),
    anchor: new google.maps.Point(18, 46),
  };
}

// Format day for display
function formatDay(day: string | null): string {
  if (!day) return "Not set";
  const dayMap: Record<string, string> = {
    MONDAY: "Monday",
    TUESDAY: "Tuesday",
    WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday",
    FRIDAY: "Friday",
    SATURDAY: "Saturday",
    SUNDAY: "Sunday",
  };
  return dayMap[day] || day;
}

// Get status display info
function getStatusInfo(item: ScheduleItem): { label: string; className: string } {
  if (item.assignedUserId) {
    return { label: "Assigned", className: "bg-green-100 text-green-700" };
  }
  return { label: "Unassigned", className: "bg-amber-100 text-amber-700" };
}

// Get subscription type display
function getTypeDisplay(item: ScheduleItem): string {
  if (item.frequency === "ONE_TIME") return "One Time";
  return "Recurring";
}

// Load saved colors from localStorage
function loadSavedColors(): Record<string, string> {
  if (typeof window === "undefined") return DEFAULT_DAY_COLORS;
  try {
    const saved = localStorage.getItem(DAY_COLORS_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_DAY_COLORS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_DAY_COLORS;
}

// Save colors to localStorage
function saveColors(colors: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DAY_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // Ignore errors
  }
}

export function ScheduleMap({
  schedule,
  techs,
  onClientClick,
  onEditSchedule,
  className = "",
}: ScheduleMapProps) {
  const [, setMap] = useState<google.maps.Map | null>(null);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [showMapKey, setShowMapKey] = useState(false);
  const [showEditColorsModal, setShowEditColorsModal] = useState(false);
  const [dayColors, setDayColors] = useState<Record<string, string>>(DEFAULT_DAY_COLORS);
  const [editingColors, setEditingColors] = useState<Record<string, string>>(DEFAULT_DAY_COLORS);

  const { isLoaded, loadError } = useGoogleMaps();

  // Load saved colors on mount
  useEffect(() => {
    const saved = loadSavedColors();
    setDayColors(saved);
    setEditingColors(saved);
  }, []);

  // Build tech color map for legend
  const techColorMap = useMemo(() => {
    const colorMap: Record<string, string> = {};
    techs.forEach((tech, index) => {
      colorMap[tech.id] = techColors[index % techColors.length];
    });
    return colorMap;
  }, [techs]);

  // Filter items that have coordinates
  const itemsWithCoords = useMemo(() => {
    return schedule.filter(
      (item) => item.latitude != null && item.longitude != null
    );
  }, [schedule]);

  // Items missing coordinates
  const itemsMissingCoords = useMemo(() => {
    return schedule.filter(
      (item) => item.latitude == null || item.longitude == null
    );
  }, [schedule]);

  // Calculate bounds from coordinates
  const bounds = useMemo(() => {
    if (itemsWithCoords.length === 0) return null;
    return calculateBounds(
      itemsWithCoords.map((item) => ({
        latitude: item.latitude!,
        longitude: item.longitude!,
      }))
    );
  }, [itemsWithCoords]);

  // Calculate center
  const center = useMemo(() => {
    if (bounds) {
      return {
        lat: (bounds.north + bounds.south) / 2,
        lng: (bounds.east + bounds.west) / 2,
      };
    }
    if (itemsWithCoords.length > 0) {
      const avgLat =
        itemsWithCoords.reduce((sum, item) => sum + item.latitude!, 0) /
        itemsWithCoords.length;
      const avgLng =
        itemsWithCoords.reduce((sum, item) => sum + item.longitude!, 0) /
        itemsWithCoords.length;
      return { lat: avgLat, lng: avgLng };
    }
    return defaultCenter;
  }, [bounds, itemsWithCoords]);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      if (bounds) {
        const googleBounds = new google.maps.LatLngBounds(
          { lat: bounds.south, lng: bounds.west },
          { lat: bounds.north, lng: bounds.east }
        );
        map.fitBounds(googleBounds);
      }
      setMap(map);
    },
    [bounds]
  );

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMarkerClick = (item: ScheduleItem) => {
    setSelectedItem(item);
    if (onClientClick) {
      onClientClick(item);
    }
  };

  // Calculate location counts per tech per day
  const locationsByTechAndDay = useMemo(() => {
    const days = [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ];
    const counts: Record<string, Record<string, number>> = {};

    // Initialize counts for all techs
    techs.forEach((tech) => {
      counts[tech.id] = {};
      days.forEach((day) => {
        counts[tech.id][day] = 0;
      });
    });

    // Count locations for each tech and day
    schedule.forEach((item) => {
      if (item.assignedUserId && item.preferredDay) {
        if (counts[item.assignedUserId]) {
          counts[item.assignedUserId][item.preferredDay] =
            (counts[item.assignedUserId][item.preferredDay] || 0) + 1;
        }
      }
    });

    return counts;
  }, [schedule, techs]);

  // Get day color for item
  const getItemDayColor = (item: ScheduleItem): string => {
    if (item.preferredDay && dayColors[item.preferredDay]) {
      return dayColors[item.preferredDay];
    }
    return unassignedColor;
  };

  // Get tech initials for item
  const getItemInitials = (item: ScheduleItem): string => {
    return getTechInitials(item.assignedTo);
  };

  // Handle opening edit colors modal
  const handleOpenEditColors = () => {
    setEditingColors({ ...dayColors });
    setShowEditColorsModal(true);
  };

  // Handle saving colors
  const handleSaveColors = () => {
    setDayColors(editingColors);
    saveColors(editingColors);
    setShowEditColorsModal(false);
  };

  // Handle reset to default colors
  const handleResetColors = () => {
    setEditingColors({ ...DEFAULT_DAY_COLORS });
  };

  // Handle cancel
  const handleCancelEditColors = () => {
    setEditingColors({ ...dayColors });
    setShowEditColorsModal(false);
  };

  if (loadError) {
    return (
      <div
        className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}
        style={{ height: "100%" }}
      >
        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Failed to load Google Maps</p>
        <p className="text-sm text-gray-400 mt-1">
          Please check your API key configuration
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={`bg-gray-100 rounded-lg p-8 flex items-center justify-center ${className}`}
        style={{ height: "100%" }}
      >
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  const days = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ];
  const dayAbbrev: Record<string, string> = {
    MONDAY: "Mon",
    TUESDAY: "Tue",
    WEDNESDAY: "Wed",
    THURSDAY: "Thu",
    FRIDAY: "Fri",
    SATURDAY: "Sat",
    SUNDAY: "Sun",
  };

  return (
    <div className={`${className}`}>
      {/* Edit Day Colors Modal */}
      {showEditColorsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Edit Day Colors
              </h2>

              <div className="space-y-4">
                {days.map((day) => (
                  <div key={day} className="flex items-center gap-4">
                    <div
                      className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer"
                      style={{ backgroundColor: editingColors[day] }}
                    />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">{formatDay(day)} Color</p>
                      <input
                        type="text"
                        value={editingColors[day]}
                        onChange={(e) =>
                          setEditingColors({
                            ...editingColors,
                            [day]: e.target.value,
                          })
                        }
                        className="w-full text-sm font-mono text-gray-900 border-b border-gray-200 focus:border-teal-500 focus:outline-none py-1"
                        placeholder="#000000"
                      />
                    </div>
                    <input
                      type="color"
                      value={editingColors[day]}
                      onChange={(e) =>
                        setEditingColors({
                          ...editingColors,
                          [day]: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-8 h-8 cursor-pointer border-0 bg-transparent"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleResetColors}
                className="mt-6 text-teal-600 hover:text-teal-700 text-sm font-medium"
              >
                Reset Default Colors
              </button>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button
                  onClick={handleCancelEditColors}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSaveColors}
                  className="px-6 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 text-sm font-medium"
                >
                  SAVE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Container with Details Panel */}
      <div
        className="rounded-lg overflow-hidden border border-gray-200 flex"
        style={{ height: "500px" }}
      >
        {/* Map */}
        <div className="flex-1 relative">
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={12}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              streetViewControl: false,
              mapTypeControl: true,
              mapTypeControlOptions: {
                position: google.maps.ControlPosition.TOP_LEFT,
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
              },
              fullscreenControl: true,
              zoomControl: true,
            }}
          >
            {/* Client markers - colored by DAY, labeled with TECH initials */}
            {itemsWithCoords.map((item) => (
              <Marker
                key={item.id}
                position={{
                  lat: item.latitude!,
                  lng: item.longitude!,
                }}
                icon={createInitialsMarkerIcon(
                  getItemInitials(item),
                  getItemDayColor(item)
                )}
                onClick={() => handleMarkerClick(item)}
                title={`${item.clientName} - ${formatDay(item.preferredDay)}`}
              />
            ))}
          </GoogleMap>
        </div>

        {/* Details Panel (shows when a pin is clicked) */}
        {selectedItem && (
          <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{
                      backgroundColor: getItemDayColor(selectedItem),
                    }}
                  >
                    {getItemInitials(selectedItem)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedItem.address}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedItem.clientName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Tech
                </p>
                <p className="text-sm text-gray-900">{selectedItem.assignedTo}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Cleanup Frequency
                </p>
                <p className="text-sm text-gray-900">
                  {selectedItem.frequencyDisplay}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Cleanup Days
                </p>
                <p className="text-sm text-gray-900">
                  {formatDay(selectedItem.preferredDay)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Status
                </p>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    getStatusInfo(selectedItem).className
                  }`}
                >
                  {getStatusInfo(selectedItem).label}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  Type
                </p>
                <p className="text-sm text-gray-900">
                  {getTypeDisplay(selectedItem)}
                </p>
              </div>

              {selectedItem.dogCount > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                    Dogs
                  </p>
                  <p className="text-sm text-gray-900">
                    {selectedItem.dogCount} dog
                    {selectedItem.dogCount > 1 ? "s" : ""}
                  </p>
                </div>
              )}

              {/* Edit Schedule Button */}
              {onEditSchedule && (
                <button
                  onClick={() => onEditSchedule(selectedItem)}
                  className="w-full mt-4 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Schedule
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map Key Section */}
      <div className="mt-4">
        <button
          onClick={() => setShowMapKey(!showMapKey)}
          className="flex items-center gap-2 text-teal-600 hover:text-teal-700 text-sm font-medium"
        >
          {showMapKey ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          {showMapKey ? "Hide" : "Show"} Map Key
        </button>

        {showMapKey && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-3">
              Each color represents day of a week.
            </p>

            {/* Day Colors */}
            <div className="space-y-2 mb-3">
              {days.map((day) => (
                <div key={day} className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: dayColors[day] }}
                  />
                  <span className="text-sm text-gray-700">{formatDay(day)}</span>
                </div>
              ))}
            </div>

            {/* Edit Colors Link */}
            <button
              onClick={handleOpenEditColors}
              className="flex items-center gap-1 text-teal-600 hover:text-teal-700 text-sm font-medium mb-3"
            >
              <Pencil className="w-3 h-3" />
              Edit colors
            </button>

            {/* Frequency Legend */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-[10px] font-medium text-gray-500">
                    1
                  </span>
                  <div>
                    <span className="text-gray-700">Once a week</span>
                    <span className="text-gray-400 text-xs ml-1">
                      Example: Thu
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-[10px] font-medium text-gray-500">
                    2
                  </span>
                  <div>
                    <span className="text-gray-700">2 times a week</span>
                    <span className="text-gray-400 text-xs ml-1">
                      Example: Wed and Fri
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-[10px] font-medium text-gray-500">
                    BW
                  </span>
                  <div>
                    <span className="text-gray-700">Bi-weekly</span>
                    <span className="text-gray-400 text-xs ml-1">
                      Example: Thu
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center text-[10px] font-medium text-gray-500">
                    M
                  </span>
                  <div>
                    <span className="text-gray-700">Once a month</span>
                    <span className="text-gray-400 text-xs ml-1">
                      Example: Thu
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tech Initials Legend */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center text-[10px] font-bold text-white">
                  JS
                </span>
                <span className="text-sm text-gray-700">
                  Letters represent tech initials
                </span>
                <span className="text-sm text-gray-400">
                  Example: John Smith
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center text-[10px] font-bold text-white">
                  ?
                </span>
                <span className="text-sm text-gray-700">Unassigned location</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Number of Locations Table */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Number of Locations
        </h3>
        <p className="text-sm text-gray-500 mb-3">
          (does not include one time and initial cleanups)
        </p>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                  Field Tech
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    className="px-3 py-3 text-center text-sm font-medium text-gray-600"
                  >
                    {dayAbbrev[day]}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {techs.map((tech, index) => {
                const techCounts = locationsByTechAndDay[tech.id] || {};
                const total = days.reduce(
                  (sum, day) => sum + (techCounts[day] || 0),
                  0
                );

                return (
                  <tr
                    key={tech.id}
                    className={index % 2 === 1 ? "bg-gray-50/50" : ""}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{
                            backgroundColor:
                              techColorMap[tech.id] || "#6B7280",
                          }}
                        >
                          {getTechInitials(tech.fullName)}
                        </span>
                        <span className="text-sm text-gray-900">
                          {tech.fullName}
                        </span>
                      </div>
                    </td>
                    {days.map((day) => (
                      <td
                        key={day}
                        className="px-3 py-2 text-center text-sm text-gray-600"
                      >
                        {techCounts[day] || 0}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900">
                      {total}
                    </td>
                  </tr>
                );
              })}
              {/* Unassigned row */}
              {(() => {
                const unassignedCounts: Record<string, number> = {};
                days.forEach((day) => {
                  unassignedCounts[day] = 0;
                });
                schedule.forEach((item) => {
                  if (!item.assignedUserId && item.preferredDay) {
                    unassignedCounts[item.preferredDay] =
                      (unassignedCounts[item.preferredDay] || 0) + 1;
                  }
                });
                const unassignedTotal = days.reduce(
                  (sum, day) => sum + (unassignedCounts[day] || 0),
                  0
                );

                // Only show unassigned row if there are unassigned items
                if (unassignedTotal === 0) return null;

                return (
                  <tr className="bg-gray-100/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold bg-gray-400">
                          ?
                        </span>
                        <span className="text-sm text-gray-500 italic">
                          Unassigned
                        </span>
                      </div>
                    </td>
                    {days.map((day) => (
                      <td
                        key={day}
                        className="px-3 py-2 text-center text-sm text-gray-500"
                      >
                        {unassignedCounts[day] || 0}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-center text-sm font-semibold text-gray-500">
                      {unassignedTotal}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tech Legend */}
      <div className="mt-4 flex flex-wrap gap-4">
        {techs.map((tech) => (
          <div key={tech.id} className="flex items-center gap-2">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: techColorMap[tech.id] || "#6B7280" }}
            />
            <span className="text-sm text-gray-600">{tech.fullName}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-4 text-sm text-gray-500">
        Showing {itemsWithCoords.length} of {schedule.length} locations on map
        {itemsMissingCoords.length > 0 && (
          <span className="ml-2 text-amber-600">
            ({itemsMissingCoords.length} missing coordinates)
          </span>
        )}
      </div>

      {/* Missing Coordinates Details */}
      {itemsMissingCoords.length > 0 && (
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Locations missing coordinates:
          </p>
          <ul className="text-sm text-amber-700 space-y-1">
            {itemsMissingCoords.map((item) => (
              <li key={item.id}>
                • {item.clientName} - {item.address}, {item.city}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
