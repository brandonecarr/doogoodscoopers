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
} from "recharts";
import type { MonthlySalesData } from "@/lib/dashboard/types";

interface TotalSalesChartProps {
  data: MonthlySalesData[];
}

export function TotalSalesChart({ data }: TotalSalesChartProps) {
  // Format data for display (show only day number)
  const chartData = data.map(d => ({
    ...d,
    day: new Date(d.date).getDate().toString(),
  }));

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}k`;
    }
    return `$${value.toFixed(0)}`;
  };

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
            tickFormatter={formatCurrency}
            width={50}
          />
          <Tooltip
            formatter={(value) => [`$${Number(value).toFixed(2)}`, ""]}
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
          <Bar dataKey="residential" name="Residential" fill="#14b8a6" stackId="a" />
          <Bar dataKey="commercial" name="Commercial" fill="#f59e0b" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
