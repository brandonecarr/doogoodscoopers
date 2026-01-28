"use client";

import { useState, useCallback, useMemo } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Polyline,
} from "@react-google-maps/api";
import { MapPin, User, Clock, Phone, Home, Dog } from "lucide-react";
import { useGoogleMaps } from "@/components/route-planner/GoogleMapsProvider";

export interface RouteStop {
  id: string;
  stopNumber: number;
  stopOrder: number;
  estimatedArrival: string | null;
  actualArrival: string | null;
  job: {
    id: string;
    status: string;
    scheduledDate: string;
    priceCents: number | null;
    notes: string | null;
    internalNotes: string | null;
    startedAt: string | null;
    completedAt: string | null;
    durationMinutes: number | null;
  } | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
  location: {
    id: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    zipCode: string;
    gateCode: string | null;
    gateLocation: string | null;
    accessNotes: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  subscription: {
    id: string;
    frequency: string;
    pricePerVisitCents: number;
  } | null;
  dogCount: number;
  dogNames: string[];
}

export interface RouteData {
  id: string;
  name: string;
  status: string;
  routeDate: string;
  startTime: string | null;
  endTime: string | null;
  assignedTo: string | null;
  assignedUser: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  } | null;
  color: string;
  stops: RouteStop[];
  progress: {
    total: number;
    completed: number;
    inProgress: number;
    percentage: number;
  };
}

interface RouteManagerMapProps {
  routes: RouteData[];
  selectedRouteId?: string | null;
  selectedStopId?: string | null;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  onStopClick?: (stop: RouteStop, route: RouteData) => void;
  showRouteLines?: boolean;
  mapType?: "roadmap" | "satellite";
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

// Create numbered marker icon as SVG data URI
function createNumberedMarkerIcon(
  number: number,
  color: string,
  status: string
): google.maps.Icon {
  const text = String(number);
  const fontSize = text.length > 2 ? 10 : text.length > 1 ? 12 : 14;

  // Determine if completed (gray out)
  const fillColor = status === "COMPLETED" ? "#9CA3AF" : color;
  const strokeColor = status === "IN_PROGRESS" ? "#22C55E" : "#ffffff";
  const strokeWidth = status === "IN_PROGRESS" ? 3 : 1;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 26 16 26s16-17.163 16-26C32 7.163 24.837 0 16 0z"/>
      <circle fill="#ffffff" cx="16" cy="14" r="10"/>
      <text x="16" y="18" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${fillColor}">${text}</text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(32, 42),
    anchor: new google.maps.Point(16, 42),
  };
}

export function RouteManagerMap({
  routes,
  selectedRouteId,
  selectedStopId,
  bounds,
  onStopClick,
  showRouteLines = true,
  mapType = "roadmap",
  className = "",
}: RouteManagerMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedStop, setSelectedStop] = useState<{
    stop: RouteStop;
    route: RouteData;
  } | null>(null);

  const { isLoaded, loadError } = useGoogleMaps();

  // Calculate center from bounds or stops
  const center = useMemo(() => {
    if (bounds) {
      return {
        lat: (bounds.north + bounds.south) / 2,
        lng: (bounds.east + bounds.west) / 2,
      };
    }

    const allStops = routes.flatMap((r) => r.stops);
    const stopsWithCoords = allStops.filter(
      (s) => s.location?.latitude && s.location?.longitude
    );

    if (stopsWithCoords.length > 0) {
      const avgLat =
        stopsWithCoords.reduce((sum, s) => sum + (s.location?.latitude || 0), 0) /
        stopsWithCoords.length;
      const avgLng =
        stopsWithCoords.reduce((sum, s) => sum + (s.location?.longitude || 0), 0) /
        stopsWithCoords.length;
      return { lat: avgLat, lng: avgLng };
    }

    return defaultCenter;
  }, [bounds, routes]);

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

  const handleMarkerClick = (stop: RouteStop, route: RouteData) => {
    setSelectedStop({ stop, route });
    if (onStopClick) {
      onStopClick(stop, route);
    }
  };

  // Get route lines for each route
  const routeLines = useMemo(() => {
    if (!showRouteLines) return [];

    return routes.map((route) => {
      const path = route.stops
        .filter((s) => s.location?.latitude && s.location?.longitude)
        .map((s) => ({
          lat: s.location!.latitude!,
          lng: s.location!.longitude!,
        }));

      return {
        routeId: route.id,
        path,
        color: route.color,
      };
    });
  }, [routes, showRouteLines]);

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

  return (
    <div className={`rounded-lg overflow-hidden ${className}`} style={{ height: "100%" }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        mapTypeId={mapType}
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
        {/* Route lines */}
        {routeLines.map((line) => (
          <Polyline
            key={line.routeId}
            path={line.path}
            options={{
              strokeColor: line.color,
              strokeOpacity: selectedRouteId && selectedRouteId !== line.routeId ? 0.3 : 0.8,
              strokeWeight: selectedRouteId === line.routeId ? 4 : 2,
            }}
          />
        ))}

        {/* Stop markers */}
        {routes.map((route) =>
          route.stops
            .filter((stop) => stop.location?.latitude && stop.location?.longitude)
            .map((stop) => {
              const isSelected = selectedStopId === stop.id;
              const isRouteSelected = selectedRouteId === route.id;
              const opacity =
                selectedRouteId && !isRouteSelected ? 0.4 : 1;

              return (
                <Marker
                  key={stop.id}
                  position={{
                    lat: stop.location!.latitude!,
                    lng: stop.location!.longitude!,
                  }}
                  icon={createNumberedMarkerIcon(
                    stop.stopNumber,
                    route.color,
                    stop.job?.status || "SCHEDULED"
                  )}
                  onClick={() => handleMarkerClick(stop, route)}
                  title={stop.client?.fullName || "Unknown"}
                  opacity={opacity}
                  zIndex={isSelected ? 1000 : isRouteSelected ? 500 : 100}
                />
              );
            })
        )}

        {/* Info window */}
        {selectedStop && selectedStop.stop.location?.latitude && selectedStop.stop.location?.longitude && (
          <InfoWindow
            position={{
              lat: selectedStop.stop.location.latitude,
              lng: selectedStop.stop.location.longitude,
            }}
            onCloseClick={() => setSelectedStop(null)}
          >
            <div className="p-1 min-w-[220px] max-w-[280px]">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: selectedStop.route.color }}
                >
                  {selectedStop.stop.stopNumber}
                </span>
                <h3 className="font-semibold text-gray-900">
                  {selectedStop.stop.client?.fullName || "Unknown Client"}
                </h3>
              </div>

              {/* Status badge */}
              <div className="mb-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedStop.stop.job?.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : selectedStop.stop.job?.status === "IN_PROGRESS"
                      ? "bg-blue-100 text-blue-700"
                      : selectedStop.stop.job?.status === "SKIPPED"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {selectedStop.stop.job?.status || "SCHEDULED"}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-sm">
                <div className="flex items-start gap-2 text-gray-600">
                  <Home className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {selectedStop.stop.location?.addressLine1}
                    <br />
                    {selectedStop.stop.location?.city}, {selectedStop.stop.location?.state} {selectedStop.stop.location?.zipCode}
                  </span>
                </div>

                {selectedStop.stop.client?.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{selectedStop.stop.client.phone}</span>
                  </div>
                )}

                {selectedStop.stop.dogCount > 0 && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Dog className="w-4 h-4 shrink-0" />
                    <span>
                      {selectedStop.stop.dogCount} dog{selectedStop.stop.dogCount > 1 ? "s" : ""}
                      {selectedStop.stop.dogNames.length > 0 && (
                        <span className="text-gray-400">
                          {" "}({selectedStop.stop.dogNames.join(", ")})
                        </span>
                      )}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-600">
                  <User className="w-4 h-4 shrink-0" />
                  <span>{selectedStop.route.assignedUser?.fullName || "Unassigned"}</span>
                </div>

                {selectedStop.stop.subscription && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>
                      {selectedStop.stop.subscription.frequency} - $
                      {(selectedStop.stop.subscription.pricePerVisitCents / 100).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedStop.stop.location?.accessNotes && (
                <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                  <span className="font-medium">Access:</span>{" "}
                  {selectedStop.stop.location.accessNotes}
                </div>
              )}

              {selectedStop.stop.location?.gateCode && (
                <div className="mt-1 text-xs text-gray-500">
                  <span className="font-medium">Gate:</span>{" "}
                  {selectedStop.stop.location.gateCode}
                  {selectedStop.stop.location.gateLocation && (
                    <span> ({selectedStop.stop.location.gateLocation})</span>
                  )}
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
