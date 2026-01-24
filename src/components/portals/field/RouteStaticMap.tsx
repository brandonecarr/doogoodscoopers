"use client";

import { useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";

interface Stop {
  id: string;
  order: number;
  job: {
    id: string;
    status: string;
    location: {
      lat: number | null;
      lng: number | null;
      addressLine1: string;
      city: string;
    } | null;
  } | null;
}

interface RouteStaticMapProps {
  stops: Stop[];
  className?: string;
}

// Marker colors by status
const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "0x6B7280", // gray
  EN_ROUTE: "0x3B82F6", // blue
  IN_PROGRESS: "0xF59E0B", // yellow
  COMPLETED: "0x10B981", // green
  SKIPPED: "0xEF4444", // red
};

/**
 * RouteStaticMap - Displays a static Google Map with route stop pins
 *
 * Uses Google Static Maps API to generate a simple map image showing
 * all stops with numbered markers color-coded by status.
 */
export function RouteStaticMap({ stops, className = "" }: RouteStaticMapProps) {
  const [imageError, setImageError] = useState(false);

  // Filter stops with valid coordinates
  const stopsWithCoords = stops.filter(
    (stop) => stop.job?.location?.lat && stop.job?.location?.lng
  );

  if (stopsWithCoords.length === 0) {
    return (
      <div className={`bg-gray-100 rounded-xl p-6 text-center ${className}`}>
        <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No location data available</p>
      </div>
    );
  }

  // Build markers string for Google Static Maps API
  // Format: markers=color:COLOR|label:LABEL|lat,lng
  const markers = stopsWithCoords
    .map((stop) => {
      const color = STATUS_COLORS[stop.job!.status] || STATUS_COLORS.SCHEDULED;
      const lat = stop.job!.location!.lat;
      const lng = stop.job!.location!.lng;
      const label = stop.order.toString();
      return `markers=color:${color}|label:${label}|${lat},${lng}`;
    })
    .join("&");

  // Calculate center and zoom based on all coordinates
  const lats = stopsWithCoords.map((s) => s.job!.location!.lat!);
  const lngs = stopsWithCoords.map((s) => s.job!.location!.lng!);
  const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

  // Build the static map URL
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${centerLat},${centerLng}&zoom=12&size=400x200&scale=2&maptype=roadmap&${markers}&key=${apiKey}`
    : null;

  // Open Google Maps with all waypoints
  const openGoogleMaps = () => {
    if (stopsWithCoords.length === 0) return;

    // Build waypoints for directions
    const waypoints = stopsWithCoords
      .slice(1, -1)
      .map((s) => `${s.job!.location!.lat},${s.job!.location!.lng}`)
      .join("|");

    const origin = `${stopsWithCoords[0].job!.location!.lat},${stopsWithCoords[0].job!.location!.lng}`;
    const destination =
      stopsWithCoords.length > 1
        ? `${stopsWithCoords[stopsWithCoords.length - 1].job!.location!.lat},${stopsWithCoords[stopsWithCoords.length - 1].job!.location!.lng}`
        : origin;

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }

    window.open(url, "_blank");
  };

  // If no API key or image error, show placeholder with open map button
  if (!mapUrl || imageError) {
    return (
      <button
        onClick={openGoogleMaps}
        className={`w-full bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 flex items-center justify-between ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
            <MapPin className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-blue-900">View Route Map</p>
            <p className="text-sm text-blue-700">
              {stopsWithCoords.length} stops • Open in Google Maps
            </p>
          </div>
        </div>
        <ExternalLink className="w-5 h-5 text-blue-600" />
      </button>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden ${className}`}>
      <img
        src={mapUrl}
        alt="Route map"
        className="w-full h-[150px] object-cover"
        onError={() => setImageError(true)}
      />
      <button
        onClick={openGoogleMaps}
        className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 flex items-center gap-1 shadow-sm"
      >
        <ExternalLink className="w-4 h-4" />
        Navigate
      </button>
      {/* Status legend */}
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs flex items-center gap-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-500" />
          Todo
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Done
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Skip
        </span>
      </div>
    </div>
  );
}
