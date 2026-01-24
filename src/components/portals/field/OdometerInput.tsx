"use client";

import { useState, useEffect } from "react";

interface OdometerInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
}

export function OdometerInput({
  value,
  onChange,
  label = "Odometer Reading",
  placeholder = "Enter current mileage",
  error,
  required = false,
}: OdometerInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  // Sync display value with actual value
  useEffect(() => {
    if (value !== null) {
      setDisplayValue(value.toLocaleString());
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");

    if (raw === "") {
      setDisplayValue("");
      onChange(null);
      return;
    }

    const numValue = parseInt(raw, 10);
    if (!isNaN(numValue)) {
      setDisplayValue(numValue.toLocaleString());
      onChange(numValue);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full px-4 py-3 rounded-lg border text-lg font-mono ${
            error
              ? "border-red-300 focus:ring-red-500 focus:border-red-500"
              : "border-gray-300 focus:ring-teal-500 focus:border-teal-500"
          }`}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          miles
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
