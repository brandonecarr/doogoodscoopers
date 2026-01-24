"use client";

import { Car, Truck, Bike } from "lucide-react";

const VEHICLE_TYPES = [
  { id: "COMPANY_VAN", label: "Company Van", icon: Truck },
  { id: "COMPANY_CAR", label: "Company Car", icon: Car },
  { id: "PERSONAL", label: "Personal Vehicle", icon: Car },
  { id: "BIKE", label: "Bike/Walk", icon: Bike },
] as const;

interface VehicleSelectorProps {
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
}

export function VehicleSelector({ value, onChange, error }: VehicleSelectorProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Vehicle
      </label>
      <div className="grid grid-cols-2 gap-3">
        {VEHICLE_TYPES.map((vehicle) => {
          const Icon = vehicle.icon;
          const isSelected = value === vehicle.id;

          return (
            <button
              key={vehicle.id}
              type="button"
              onClick={() => onChange(vehicle.id)}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                isSelected
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              <Icon className={`w-8 h-8 ${isSelected ? "text-teal-600" : "text-gray-400"}`} />
              <span className="text-sm font-medium">{vehicle.label}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
