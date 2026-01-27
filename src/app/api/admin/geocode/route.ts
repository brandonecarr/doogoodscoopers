/**
 * Geocoding API
 *
 * Geocodes an address using Google Geocoding API.
 * Returns latitude, longitude, and formatted address.
 *
 * Requires locations:read permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateWithPermission, errorResponse } from "@/lib/api-auth";

interface GeocodeRequest {
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

interface GeocodeResponse {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/**
 * POST /api/admin/geocode
 * Geocode an address to coordinates
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateWithPermission(request, "locations:read");
  if (!auth.user) {
    return errorResponse(auth.error!, auth.status);
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body: GeocodeRequest = await request.json();

    if (!body.address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // Build the full address string
    const addressParts = [body.address];
    if (body.city) addressParts.push(body.city);
    if (body.state) addressParts.push(body.state);
    if (body.zipCode) addressParts.push(body.zipCode);
    const fullAddress = addressParts.join(", ");

    // Call Google Geocoding API
    const geocodeUrl = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    geocodeUrl.searchParams.set("address", fullAddress);
    geocodeUrl.searchParams.set("key", apiKey);

    const geocodeResponse = await fetch(geocodeUrl.toString());
    const geocodeData = await geocodeResponse.json();

    if (geocodeData.status === "ZERO_RESULTS") {
      return NextResponse.json(
        { error: "No results found for this address" },
        { status: 404 }
      );
    }

    if (geocodeData.status !== "OK") {
      console.error("Geocoding API error:", geocodeData.status, geocodeData.error_message);
      return NextResponse.json(
        { error: `Geocoding failed: ${geocodeData.status}` },
        { status: 500 }
      );
    }

    const result = geocodeData.results[0];
    const location = result.geometry.location;

    const response: GeocodeResponse = {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in geocode API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
