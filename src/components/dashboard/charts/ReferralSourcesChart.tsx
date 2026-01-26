"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ReferralSourceData } from "@/lib/dashboard/types";

interface ReferralSourcesChartProps {
  data: ReferralSourceData[];
}

// Colors for referral sources
const REFERRAL_COLORS = [
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#ef4444", // red
  "#10b981", // emerald
  "#ec4899", // pink
  "#6366f1", // indigo
  "#f97316", // orange
  "#84cc16", // lime
];

export function ReferralSourcesChart({ data }: ReferralSourcesChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
        No referral data available
      </div>
    );
  }

  // Add colors to data
  const coloredData = data.map((item, index) => ({
    ...item,
    color: REFERRAL_COLORS[index % REFERRAL_COLORS.length],
  }));

  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={coloredData}
            layout="vertical"
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
            />
            <YAxis
              type="category"
              dataKey="source"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#6b7280" }}
              width={120}
            />
            <Tooltip
              formatter={(value: number) => [value, "Count"]}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar
              dataKey="count"
              fill="#14b8a6"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {coloredData.map((item, index) => (
          <div key={index} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-600">{item.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
