"use client";

import { useState, useEffect } from "react";
import { Dog, Users, MapPin, Calendar } from "lucide-react";

interface PublicMetrics {
  satisfiedCustomers: number;
  happyPets: number;
  completedYards: number;
  yearsInBusiness: number;
  lastUpdated: string;
}

interface PetYardTrackerProps {
  orgSlug?: string;
  theme?: "light" | "dark";
  showTitle?: boolean;
  animate?: boolean;
  className?: string;
}

/**
 * PetYard Tracker Widget
 *
 * Embeddable widget displaying public metrics for the organization.
 * Can be embedded on the main website or any external site.
 *
 * Usage:
 * <PetYardTracker orgSlug="doogoodscoopers" theme="light" />
 */
export function PetYardTracker({
  orgSlug,
  theme = "light",
  showTitle = true,
  animate = true,
  className = "",
}: PetYardTrackerProps) {
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayedValues, setDisplayedValues] = useState({
    satisfiedCustomers: 0,
    happyPets: 0,
    completedYards: 0,
    yearsInBusiness: 0,
  });

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const params = orgSlug ? `?org=${orgSlug}` : "";
        const res = await fetch(`/api/public/metrics${params}`);
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error("Error fetching metrics:", err);
        // Use fallback values
        setMetrics({
          satisfiedCustomers: 500,
          happyPets: 1200,
          completedYards: 25000,
          yearsInBusiness: 5,
          lastUpdated: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, [orgSlug]);

  // Animate numbers counting up
  useEffect(() => {
    if (!metrics || !animate) {
      if (metrics) {
        setDisplayedValues({
          satisfiedCustomers: metrics.satisfiedCustomers,
          happyPets: metrics.happyPets,
          completedYards: metrics.completedYards,
          yearsInBusiness: metrics.yearsInBusiness,
        });
      }
      return;
    }

    const duration = 2000; // 2 seconds
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      setDisplayedValues({
        satisfiedCustomers: Math.round(metrics.satisfiedCustomers * eased),
        happyPets: Math.round(metrics.happyPets * eased),
        completedYards: Math.round(metrics.completedYards * eased),
        yearsInBusiness: Math.round(metrics.yearsInBusiness * eased),
      });

      if (step >= steps) {
        clearInterval(timer);
        setDisplayedValues({
          satisfiedCustomers: metrics.satisfiedCustomers,
          happyPets: metrics.happyPets,
          completedYards: metrics.completedYards,
          yearsInBusiness: metrics.yearsInBusiness,
        });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [metrics, animate]);

  const isDark = theme === "dark";

  if (loading) {
    return (
      <div
        className={`p-6 rounded-xl ${
          isDark ? "bg-navy-900" : "bg-white"
        } ${className}`}
      >
        <div className="flex items-center justify-center py-8">
          <div
            className={`animate-spin w-8 h-8 border-3 border-t-transparent rounded-full ${
              isDark ? "border-teal-400" : "border-teal-600"
            }`}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-6 rounded-xl ${
        isDark ? "bg-navy-900 text-white" : "bg-white text-gray-900"
      } ${className}`}
    >
      {showTitle && (
        <div className="text-center mb-6">
          <h3
            className={`text-xl font-bold ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            PetYard Tracker
          </h3>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            Our impact by the numbers
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Satisfied Customers */}
        <div
          className={`text-center p-4 rounded-lg ${
            isDark ? "bg-navy-800" : "bg-teal-50"
          }`}
        >
          <div
            className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${
              isDark ? "bg-teal-600" : "bg-teal-100"
            }`}
          >
            <Users
              className={`w-5 h-5 ${isDark ? "text-white" : "text-teal-600"}`}
            />
          </div>
          <p
            className={`text-2xl md:text-3xl font-bold ${
              isDark ? "text-teal-400" : "text-teal-600"
            }`}
          >
            {displayedValues.satisfiedCustomers.toLocaleString()}+
          </p>
          <p
            className={`text-xs md:text-sm ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Satisfied Customers
          </p>
        </div>

        {/* Happy Pets */}
        <div
          className={`text-center p-4 rounded-lg ${
            isDark ? "bg-navy-800" : "bg-amber-50"
          }`}
        >
          <div
            className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${
              isDark ? "bg-amber-600" : "bg-amber-100"
            }`}
          >
            <Dog
              className={`w-5 h-5 ${isDark ? "text-white" : "text-amber-600"}`}
            />
          </div>
          <p
            className={`text-2xl md:text-3xl font-bold ${
              isDark ? "text-amber-400" : "text-amber-600"
            }`}
          >
            {displayedValues.happyPets.toLocaleString()}+
          </p>
          <p
            className={`text-xs md:text-sm ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Happy Pets
          </p>
        </div>

        {/* Completed Yards */}
        <div
          className={`text-center p-4 rounded-lg ${
            isDark ? "bg-navy-800" : "bg-green-50"
          }`}
        >
          <div
            className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${
              isDark ? "bg-green-600" : "bg-green-100"
            }`}
          >
            <MapPin
              className={`w-5 h-5 ${isDark ? "text-white" : "text-green-600"}`}
            />
          </div>
          <p
            className={`text-2xl md:text-3xl font-bold ${
              isDark ? "text-green-400" : "text-green-600"
            }`}
          >
            {displayedValues.completedYards.toLocaleString()}+
          </p>
          <p
            className={`text-xs md:text-sm ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Yards Cleaned
          </p>
        </div>

        {/* Years in Business */}
        <div
          className={`text-center p-4 rounded-lg ${
            isDark ? "bg-navy-800" : "bg-purple-50"
          }`}
        >
          <div
            className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${
              isDark ? "bg-purple-600" : "bg-purple-100"
            }`}
          >
            <Calendar
              className={`w-5 h-5 ${isDark ? "text-white" : "text-purple-600"}`}
            />
          </div>
          <p
            className={`text-2xl md:text-3xl font-bold ${
              isDark ? "text-purple-400" : "text-purple-600"
            }`}
          >
            {displayedValues.yearsInBusiness}+
          </p>
          <p
            className={`text-xs md:text-sm ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Years of Service
          </p>
        </div>
      </div>

      {/* Branding */}
      <div className="mt-4 text-center">
        <p className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          Powered by DooGoodScoopers
        </p>
      </div>
    </div>
  );
}

/**
 * Compact version of PetYard Tracker for smaller spaces
 */
export function PetYardTrackerCompact({
  orgSlug,
  theme = "light",
  className = "",
}: Omit<PetYardTrackerProps, "showTitle" | "animate">) {
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const params = orgSlug ? `?org=${orgSlug}` : "";
        const res = await fetch(`/api/public/metrics${params}`);
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error("Error fetching metrics:", err);
        setMetrics({
          satisfiedCustomers: 500,
          happyPets: 1200,
          completedYards: 25000,
          yearsInBusiness: 5,
          lastUpdated: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, [orgSlug]);

  const isDark = theme === "dark";

  if (loading || !metrics) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-4 px-4 py-2 rounded-full ${
        isDark ? "bg-navy-800 text-white" : "bg-gray-100 text-gray-900"
      } ${className}`}
    >
      <span className="flex items-center gap-1">
        <Users className="w-4 h-4 text-teal-500" />
        <span className="font-medium">
          {metrics.satisfiedCustomers.toLocaleString()}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <Dog className="w-4 h-4 text-amber-500" />
        <span className="font-medium">
          {metrics.happyPets.toLocaleString()}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <MapPin className="w-4 h-4 text-green-500" />
        <span className="font-medium">
          {metrics.completedYards.toLocaleString()}
        </span>
      </span>
    </div>
  );
}

export default PetYardTracker;
