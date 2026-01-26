"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonthlyDataPoint } from "@/lib/dashboard/types";

interface ActiveClientsChartProps {
  data: MonthlyDataPoint[];
  label: string;
  color?: string;
}

export function ActiveClientsChart({ data, label, color = "#14b8a6" }: ActiveClientsChartProps) {
  // Format data for display (show only day number)
  const chartData = data.map(d => ({
    ...d,
    day: new Date(d.date).getDate().toString(),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            interval="preserveStartEnd"
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            width={40}
          />
          <Tooltip
            formatter={(value) => [value, label]}
            labelFormatter={(labelValue) => `Day ${labelValue}`}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }}
            iconType="square"
            iconSize={10}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={label}
            stroke={color}
            fill={`url(#gradient-${label.replace(/\s/g, "")})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
