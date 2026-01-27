"use client";

import { useState, useRef, useCallback } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { useGoogleMaps } from "./GoogleMapsProvider";

interface AddressResult {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

interface AddressSearchProps {
  onAddressSelect: (result: AddressResult) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
}

export function AddressSearch({
  onAddressSelect,
  onClear,
  placeholder = "Enter address to search...",
  className = "",
  defaultValue = "",
}: AddressSearchProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [autocomplete, setAutocomplete] =
    useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isLoaded, loadError } = useGoogleMaps();

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    setAutocomplete(autocomplete);
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (autocomplete) {
      const place = autocomplete.getPlace();

      if (place.geometry?.location && place.address_components) {
        // Extract address components
        let streetNumber = "";
        let route = "";
        let city = "";
        let state = "";
        let zipCode = "";

        for (const component of place.address_components) {
          const types = component.types;
          if (types.includes("street_number")) {
            streetNumber = component.long_name;
          } else if (types.includes("route")) {
            route = component.long_name;
          } else if (types.includes("locality")) {
            city = component.long_name;
          } else if (types.includes("administrative_area_level_1")) {
            state = component.short_name;
          } else if (types.includes("postal_code")) {
            zipCode = component.long_name;
          }
        }

        const address = streetNumber
          ? `${streetNumber} ${route}`
          : route || place.name || "";

        const result: AddressResult = {
          address,
          city,
          state,
          zipCode,
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
          formattedAddress: place.formatted_address || "",
        };

        setInputValue(place.formatted_address || address);
        onAddressSelect(result);
      }
    }
  }, [autocomplete, onAddressSelect]);

  const handleClear = () => {
    setInputValue("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
    if (onClear) {
      onClear();
    }
  };

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  if (loadError) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 px-4 py-3 border border-red-300 rounded-lg bg-red-50">
          <MapPin className="w-5 h-5 text-red-400" />
          <span className="text-red-600 text-sm">
            Failed to load address search
          </span>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          <span className="text-gray-500 text-sm">Loading search...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          types: ["address"],
          componentRestrictions: { country: "us" },
        }}
      >
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="w-full pl-12 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-gray-900 placeholder:text-gray-400"
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </Autocomplete>
    </div>
  );
}
