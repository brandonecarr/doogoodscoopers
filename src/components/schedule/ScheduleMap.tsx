"use client";

import { useState, useCallback, useMemo } from "react";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { MapPin, User, Calendar, Clock, Home, Dog } from "lucide-react";
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

// Tech colors for map pins
const techColors = [
  "#10B981", // emerald
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#F97316", // orange
  "#6366F1", // indigo
  "#84CC16", // lime
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

// Create marker icon with tech initials as SVG data URI
function createInitialsMarkerIcon(initials: string, color: string): google.maps.Icon {
  const fontSize = initials.length > 2 ? 10 : 12;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
      <path fill="${color}" stroke="#ffffff" stroke-width="2" d="M18 0C8.059 0 0 8.059 0 18c0 9.941 18 28 18 28s18-18.059 18-28C36 8.059 27.941 0 18 0z"/>
      <circle fill="#ffffff" cx="18" cy="16" r="11"/>
      <text x="18" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${color}">${initials}</text>
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

export function ScheduleMap({
  schedule,
  techs,
  selectedTechId,
  selectedFrequency,
  selectedDay,
  onClientClick,
  className = "",
}: ScheduleMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);

  const { isLoaded, loadError } = useGoogleMaps();

  // Build tech color map based on tech order
  const techColorMap = useMemo(() => {
    const colorMap: Record<string, string> = {};
    techs.forEach((tech, index) => {
      colorMap[tech.id] = techColors[index % techColors.length];
    });
    return colorMap;
  }, [techs]);

  // Build tech initials map
  const techInitialsMap = useMemo(() => {
    const initialsMap: Record<string, string> = {};
    techs.forEach((tech) => {
      initialsMap[tech.id] = getTechInitials(tech.fullName);
    });
    return initialsMap;
  }, [techs]);

  // Filter items that have coordinates
  const itemsWithCoords = useMemo(() => {
    return schedule.filter(
      (item) => item.latitude != null && item.longitude != null
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
    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
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

  // Get tech color for item
  const getItemColor = (item: ScheduleItem): string => {
    if (item.assignedUserId && techColorMap[item.assignedUserId]) {
      return techColorMap[item.assignedUserId];
    }
    return "#6B7280"; // Gray for unassigned
  };

  // Get tech initials for item
  const getItemInitials = (item: ScheduleItem): string => {
    if (item.assignedUserId && techInitialsMap[item.assignedUserId]) {
      return techInitialsMap[item.assignedUserId];
    }
    return "?";
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

  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
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
      {/* Map Container */}
      <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: "500px" }}>
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
              position: google.maps.ControlPosition.TOP_RIGHT,
              style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            },
            fullscreenControl: true,
            zoomControl: true,
          }}
        >
          {/* Client markers */}
          {itemsWithCoords.map((item) => (
            <Marker
              key={item.id}
              position={{
                lat: item.latitude!,
                lng: item.longitude!,
              }}
              icon={createInitialsMarkerIcon(
                getItemInitials(item),
                getItemColor(item)
              )}
              onClick={() => handleMarkerClick(item)}
              title={item.clientName}
            />
          ))}

          {/* Info window */}
          {selectedItem && selectedItem.latitude && selectedItem.longitude && (
            <InfoWindow
              position={{
                lat: selectedItem.latitude,
                lng: selectedItem.longitude,
              }}
              onCloseClick={() => setSelectedItem(null)}
            >
              <div className="p-1 min-w-[220px] max-w-[300px]">
                {/* Header with status badge */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">
                    {selectedItem.clientName}
                  </h3>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    {selectedItem.status}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-start gap-2 text-gray-600">
                    <Home className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>
                      {selectedItem.address}
                      {selectedItem.addressLine2 && (
                        <>
                          <br />
                          {selectedItem.addressLine2}
                        </>
                      )}
                      <br />
                      {selectedItem.city}, {selectedItem.state} {selectedItem.zipCode}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4 shrink-0" />
                    <span>{selectedItem.assignedTo}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>{selectedItem.frequencyDisplay}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>{formatDay(selectedItem.preferredDay)}</span>
                  </div>

                  {selectedItem.dogCount > 0 && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Dog className="w-4 h-4 shrink-0" />
                      <span>
                        {selectedItem.dogCount} dog{selectedItem.dogCount > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  {selectedItem.planName && (
                    <div className="pt-1 border-t text-xs text-gray-500">
                      <span className="font-medium">Plan:</span> {selectedItem.planName}
                    </div>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Number of Locations Table */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Number of Locations</h3>
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
                          style={{ backgroundColor: techColorMap[tech.id] || "#6B7280" }}
                        >
                          {getTechInitials(tech.fullName)}
                        </span>
                        <span className="text-sm text-gray-900">{tech.fullName}</span>
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

      {/* Legend */}
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
        {schedule.length - itemsWithCoords.length > 0 && (
          <span className="ml-2 text-amber-600">
            ({schedule.length - itemsWithCoords.length} missing coordinates)
          </span>
        )}
      </div>
    </div>
  );
}
