"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { NewVsLostData } from "@/lib/dashboard/types";

interface NewVsLostChartProps {
  data: NewVsLostData[];
  summary: {
    new: number;
    lost: number;
    net: number;
  };
}

export function NewVsLostChart({ data, summary }: NewVsLostChartProps) {
  // Transform data for the bar chart - lost should be negative
  const chartData = data.map(d => ({
    day: new Date(d.date).getDate().toString(),
    new: d.new,
    lost: -d.lost, // Make lost negative for visual effect
    net: d.net,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            formatter={(value, name) => {
              const numValue = Number(value);
              if (name === "lost") return [Math.abs(numValue), "Lost"];
              return [numValue, String(name).charAt(0).toUpperCase() + String(name).slice(1)];
            }}
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
            formatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
          />
          <ReferenceLine y={0} stroke="#d1d5db" />
          <Bar dataKey="new" name="new" fill="#14b8a6" />
          <Bar dataKey="lost" name="lost" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
