"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface ZipCodeCheckerProps {
  onResult: (result: { inServiceArea: boolean; zipCode: string; message: string }) => void;
  initialZipCode?: string;
}

export function ZipCodeChecker({ onResult, initialZipCode = "" }: ZipCodeCheckerProps) {
  const [zipCode, setZipCode] = useState(initialZipCode);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{
    checked: boolean;
    inServiceArea: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    // Validate format
    if (!/^\d{5}$/.test(zipCode)) {
      setError("Please enter a valid 5-digit ZIP code");
      return;
    }

    setError(null);
    setIsChecking(true);
    setResult(null);

    try {
      const response = await fetch("/api/v2/check-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipCode }),
      });

      const data = await response.json();

      setResult({
        checked: true,
        inServiceArea: data.inServiceArea,
        message: data.message || (data.inServiceArea
          ? "Great news! We service your area."
          : "We don't currently serve this area."),
      });

      onResult({
        inServiceArea: data.inServiceArea,
        zipCode,
        message: data.message,
      });

    } catch (err) {
      console.error("Error checking zip code:", err);
      setError("Unable to check your ZIP code. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && zipCode.length === 5) {
      handleCheck();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative">
        {/* Input Group */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              value={zipCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 5);
                setZipCode(value);
                setResult(null);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter your ZIP code"
              className="w-full pl-12 pr-4 py-4 text-lg rounded-xl border-2 border-gray-200 focus:border-teal-400 focus:ring-4 focus:ring-teal-100 outline-none transition-all"
              disabled={isChecking}
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCheck}
            disabled={zipCode.length !== 5 || isChecking}
            className="px-6 py-4 bg-gradient-to-r from-teal-400 to-teal-500 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-xl"
          >
            {isChecking ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "Check"
            )}
          </motion.button>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-2 text-sm text-red-500 flex items-center gap-1"
            >
              <XCircle className="w-4 h-4" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Result Message */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: 10, height: 0 }}
              className={`mt-4 p-4 rounded-xl flex items-start gap-3 ${
                result.inServiceArea
                  ? "bg-green-50 border border-green-200"
                  : "bg-amber-50 border border-amber-200"
              }`}
            >
              {result.inServiceArea ? (
                <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p
                  className={`font-medium ${
                    result.inServiceArea ? "text-green-700" : "text-amber-700"
                  }`}
                >
                  {result.inServiceArea ? "We're in your area!" : "Not in our service area yet"}
                </p>
                <p
                  className={`text-sm mt-1 ${
                    result.inServiceArea ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {result.message}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
