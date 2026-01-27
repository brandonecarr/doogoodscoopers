"use client";

import { useState, useCallback, useMemo } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import { MapPin, User, Calendar, Clock, Navigation } from "lucide-react";
import { useGoogleMaps } from "./GoogleMapsProvider";
import { formatDistance, calculateAirDistance } from "@/lib/distance-utils";

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

interface NewClientLocation {
  latitude: number;
  longitude: number;
  address: string;
}

interface RoutePlannerMapProps {
  clients: MapClient[];
  techs: MapTech[];
  newClientLocation?: NewClientLocation | null;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
  selectedDay?: string | null;
  selectedTechId?: string | null;
  onClientClick?: (client: MapClient) => void;
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

// Format day names for display
function formatServiceDays(days: string[]): string {
  if (days.length === 0) return "Not set";
  const dayAbbrev: Record<string, string> = {
    MONDAY: "Mon",
    TUESDAY: "Tue",
    WEDNESDAY: "Wed",
    THURSDAY: "Thu",
    FRIDAY: "Fri",
    SATURDAY: "Sat",
    SUNDAY: "Sun",
  };
  return days.map((d) => dayAbbrev[d] || d).join(", ");
}

// Create numbered marker icon as SVG data URI
function createNumberedMarkerIcon(
  number: number | string,
  color: string
): google.maps.Icon {
  const text = String(number);
  const fontSize = text.length > 2 ? 10 : text.length > 1 ? 12 : 14;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path fill="${color}" stroke="#ffffff" stroke-width="1" d="M16 0C7.163 0 0 7.163 0 16c0 8.837 16 26 16 26s16-17.163 16-26C32 7.163 24.837 0 16 0z"/>
      <circle fill="#ffffff" cx="16" cy="14" r="10"/>
      <text x="16" y="18" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${color}">${text}</text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(32, 42),
    anchor: new google.maps.Point(16, 42),
  };
}

// Create "NC" marker for new client as SVG data URI
function createNewClientMarkerIcon(): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
      <path fill="#FF5722" stroke="#ffffff" stroke-width="2" d="M19 0C8.507 0 0 8.507 0 19c0 10.493 19 29 19 29s19-18.507 19-29C38 8.507 29.493 0 19 0z"/>
      <circle fill="#ffffff" cx="19" cy="17" r="12"/>
      <text x="19" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#FF5722">NC</text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(38, 48),
    anchor: new google.maps.Point(19, 48),
  };
}

export function RoutePlannerMap({
  clients,
  techs,
  newClientLocation,
  bounds,
  selectedDay,
  selectedTechId,
  onClientClick,
  className = "",
}: RoutePlannerMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedClient, setSelectedClient] = useState<MapClient | null>(null);
  const [showNewClientInfo, setShowNewClientInfo] = useState(false);

  const { isLoaded, loadError } = useGoogleMaps();

  // Build tech color map
  const techColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    techs.forEach((tech) => {
      map[tech.id] = tech.color;
    });
    return map;
  }, [techs]);

  // Calculate center from bounds or use default
  const center = useMemo(() => {
    if (newClientLocation) {
      return {
        lat: newClientLocation.latitude,
        lng: newClientLocation.longitude,
      };
    }
    if (bounds) {
      return {
        lat: (bounds.north + bounds.south) / 2,
        lng: (bounds.east + bounds.west) / 2,
      };
    }
    if (clients.length > 0) {
      const avgLat =
        clients.reduce((sum, c) => sum + c.latitude, 0) / clients.length;
      const avgLng =
        clients.reduce((sum, c) => sum + c.longitude, 0) / clients.length;
      return { lat: avgLat, lng: avgLng };
    }
    return defaultCenter;
  }, [bounds, clients, newClientLocation]);

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

  const handleMarkerClick = (client: MapClient) => {
    setSelectedClient(client);
    setShowNewClientInfo(false);
    if (onClientClick) {
      onClientClick(client);
    }
  };

  const handleNewClientMarkerClick = () => {
    setSelectedClient(null);
    setShowNewClientInfo(true);
  };

  // Calculate distance from new client to selected client
  const getDistanceToNewClient = (client: MapClient): string => {
    if (!newClientLocation) return "";
    const meters = calculateAirDistance(
      newClientLocation.latitude,
      newClientLocation.longitude,
      client.latitude,
      client.longitude
    );
    return formatDistance(meters, "miles");
  };

  if (loadError) {
    return (
      <div
        className={`bg-gray-100 rounded-xl p-8 text-center ${className}`}
        style={{ height: "500px" }}
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
        className={`bg-gray-100 rounded-xl p-8 flex items-center justify-center ${className}`}
        style={{ height: "500px" }}
      >
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden ${className}`} style={{ height: "500px" }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        {/* Client markers */}
        {clients.map((client) => {
          const markerColor = client.techId
            ? techColorMap[client.techId] || "#6B7280"
            : "#6B7280"; // Gray for unassigned

          return (
            <Marker
              key={client.subscriptionId}
              position={{ lat: client.latitude, lng: client.longitude }}
              icon={createNumberedMarkerIcon(client.pinNumber, markerColor)}
              onClick={() => handleMarkerClick(client)}
              title={client.clientName}
            />
          );
        })}

        {/* New client marker */}
        {newClientLocation && (
          <Marker
            position={{
              lat: newClientLocation.latitude,
              lng: newClientLocation.longitude,
            }}
            icon={createNewClientMarkerIcon()}
            onClick={handleNewClientMarkerClick}
            title="New Client Location"
            zIndex={1000} // Show above other markers
          />
        )}

        {/* Client info window */}
        {selectedClient && (
          <InfoWindow
            position={{
              lat: selectedClient.latitude,
              lng: selectedClient.longitude,
            }}
            onCloseClick={() => setSelectedClient(null)}
          >
            <div className="p-1 min-w-[200px]">
              <h3 className="font-semibold text-gray-900 mb-2">
                {selectedClient.clientName}
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {selectedClient.address}
                    <br />
                    {selectedClient.city}, {selectedClient.zipCode}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>{formatServiceDays(selectedClient.serviceDays)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="w-4 h-4 shrink-0" />
                  <span>{selectedClient.techName}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{selectedClient.subscriptionType}</span>
                </div>
                {newClientLocation && (
                  <div className="flex items-center gap-2 text-primary font-medium pt-1 border-t">
                    <Navigation className="w-4 h-4 shrink-0" />
                    <span>{getDistanceToNewClient(selectedClient)} from NC</span>
                  </div>
                )}
              </div>
            </div>
          </InfoWindow>
        )}

        {/* New client info window */}
        {showNewClientInfo && newClientLocation && (
          <InfoWindow
            position={{
              lat: newClientLocation.latitude,
              lng: newClientLocation.longitude,
            }}
            onCloseClick={() => setShowNewClientInfo(false)}
          >
            <div className="p-1 min-w-[180px]">
              <h3 className="font-semibold text-orange-600 mb-2">
                New Client Location
              </h3>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{newClientLocation.address}</span>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
