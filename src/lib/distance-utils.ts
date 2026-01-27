/**
 * Distance Calculation Utilities
 *
 * Provides functions for calculating distances between coordinates.
 * Uses Haversine formula for air distance (fast, no API calls).
 * Optionally uses Google Distance Matrix for driving distances.
 */

/**
 * Earth's radius in meters
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate the air distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateAirDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return meters * 0.000621371;
}

/**
 * Convert meters to kilometers
 */
export function metersToKilometers(meters: number): number {
  return meters / 1000;
}

/**
 * Format distance for display
 * @param meters Distance in meters
 * @param unit 'miles' or 'km'
 * @returns Formatted string like "2.3 mi" or "3.7 km"
 */
export function formatDistance(
  meters: number,
  unit: "miles" | "km" = "miles"
): string {
  if (unit === "miles") {
    const miles = metersToMiles(meters);
    return `${miles.toFixed(1)} mi`;
  } else {
    const km = metersToKilometers(meters);
    return `${km.toFixed(1)} km`;
  }
}

/**
 * Calculate driving distance using Google Distance Matrix API
 * Note: This makes an API call and incurs costs
 */
export async function calculateDrivingDistance(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  apiKey?: string
): Promise<{ meters: number; seconds: number } | null> {
  const key = apiKey || process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    console.error("Google Maps API key not configured");
    return null;
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", `${origin.lat},${origin.lng}`);
    url.searchParams.set("destinations", `${destination.lat},${destination.lng}`);
    url.searchParams.set("key", key);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== "OK") {
      console.error("Distance Matrix API error:", data.status);
      return null;
    }

    const element = data.rows[0]?.elements[0];
    if (element?.status !== "OK") {
      console.error("Distance Matrix element error:", element?.status);
      return null;
    }

    return {
      meters: element.distance.value,
      seconds: element.duration.value,
    };
  } catch (error) {
    console.error("Error calling Distance Matrix API:", error);
    return null;
  }
}

/**
 * Format driving time for display
 * @param seconds Duration in seconds
 * @returns Formatted string like "15 min" or "1 hr 30 min"
 */
export function formatDrivingTime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Find the nearest location from a list of locations
 */
export function findNearestLocation<T extends { latitude: number; longitude: number }>(
  targetLat: number,
  targetLon: number,
  locations: T[]
): { location: T; distance: number } | null {
  if (locations.length === 0) {
    return null;
  }

  let nearest: T = locations[0];
  let nearestDistance = calculateAirDistance(
    targetLat,
    targetLon,
    nearest.latitude,
    nearest.longitude
  );

  for (let i = 1; i < locations.length; i++) {
    const loc = locations[i];
    const distance = calculateAirDistance(
      targetLat,
      targetLon,
      loc.latitude,
      loc.longitude
    );
    if (distance < nearestDistance) {
      nearest = loc;
      nearestDistance = distance;
    }
  }

  return { location: nearest, distance: nearestDistance };
}

/**
 * Sort locations by distance from a target point
 */
export function sortByDistance<T extends { latitude: number; longitude: number }>(
  targetLat: number,
  targetLon: number,
  locations: T[]
): Array<T & { distance: number }> {
  return locations
    .map((loc) => ({
      ...loc,
      distance: calculateAirDistance(
        targetLat,
        targetLon,
        loc.latitude,
        loc.longitude
      ),
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Calculate the bounding box for a set of coordinates
 */
export function calculateBounds(
  coordinates: Array<{ latitude: number; longitude: number }>
): { north: number; south: number; east: number; west: number } | null {
  if (coordinates.length === 0) {
    return null;
  }

  let north = coordinates[0].latitude;
  let south = coordinates[0].latitude;
  let east = coordinates[0].longitude;
  let west = coordinates[0].longitude;

  for (const coord of coordinates) {
    if (coord.latitude > north) north = coord.latitude;
    if (coord.latitude < south) south = coord.latitude;
    if (coord.longitude > east) east = coord.longitude;
    if (coord.longitude < west) west = coord.longitude;
  }

  // Add padding (roughly 0.5 miles)
  const padding = 0.008;
  return {
    north: north + padding,
    south: south - padding,
    east: east + padding,
    west: west - padding,
  };
}

/**
 * Calculate the center point of a bounding box
 */
export function calculateCenter(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): { lat: number; lng: number } {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}
