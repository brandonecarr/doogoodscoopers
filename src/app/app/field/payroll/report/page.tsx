"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";

interface PayrollEntry {
  id: string;
  date: string;
  hoursWorked: number;
  rate: number;
  amount: number;
  status: "PENDING" | "PAID";
}

export default function PayrollReportPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);

  const fetchPayroll = useCallback(async () => {
    try {
      const res = await fetch("/api/field/payroll/report");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error("Error fetching payroll:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

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
        <h2 className="text-lg font-semibold text-gray-900">Payroll Report</h2>
      </div>

      {entries.length === 0 ? (
        <div className="py-12 text-center">
          <DollarSign className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">No payroll entries found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900">{entry.date}</p>
                <p className="text-sm text-gray-500">
                  {entry.hoursWorked} hours @ ${entry.rate.toFixed(2)}/hr
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">
                  ${entry.amount.toFixed(2)}
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    entry.status === "PAID"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {entry.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </FieldContentCard>
  );
}
