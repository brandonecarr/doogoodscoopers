"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";

interface ProductivityData {
  period: string;
  jobsCompleted: number;
  averageTimePerJob: number;
  totalHours: number;
  efficiency: number;
}

export default function ProductivityReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProductivityData[]>([]);

  const fetchProductivity = useCallback(async () => {
    try {
      const res = await fetch("/api/field/payroll/productivity");
      if (res.ok) {
        const result = await res.json();
        setData(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching productivity:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProductivity();
  }, [fetchProductivity]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <FieldContentCard className="mt-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Productivity Report</h2>
      </div>

      {data.length === 0 ? (
        <div className="py-12 text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">No productivity data available</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.map((item) => (
            <div key={item.period} className="space-y-3">
              <h3 className="font-semibold text-gray-900">{item.period}</h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Jobs Completed</p>
                  <p className="text-2xl font-bold text-teal-600">
                    {item.jobsCompleted}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Avg Time/Job</p>
                  <p className="text-2xl font-bold text-teal-600">
                    {item.averageTimePerJob} min
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Total Hours</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {item.totalHours.toFixed(1)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase">Efficiency</p>
                  <p className="text-2xl font-bold text-green-600">
                    {item.efficiency}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </FieldContentCard>
  );
}
