"use client";

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export interface GrowthPoint {
  month: string;   // YYYY-MM
  label: string;   // "Jan '25"
  signups: number;
  cancels: number;
  active: number;  // cumulative net active at month end
  quotes: number;
}

interface TipEntry { name: string; value: number; color: string }

function Tip({ active, payload, label }: { active?: boolean; payload?: TipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const get = (n: string) => payload.find((p) => p.name === n)?.value ?? 0;
  return (
    <div className="rounded-xl border border-hairline bg-white px-3 py-2 shadow-lg text-[12px]">
      <p className="font-semibold text-ink mb-1">{label}</p>
      <p className="flex items-center justify-between gap-4"><span className="text-[#6D3EF0]">Signups</span><span className="font-semibold">+{get("Signups")}</span></p>
      <p className="flex items-center justify-between gap-4"><span className="text-[#F43F5E]">Cancellations</span><span className="font-semibold">−{get("Cancellations")}</span></p>
      <p className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-hairline"><span className="text-ink">Active</span><span className="font-bold">{get("Active customers")}</span></p>
    </div>
  );
}

export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  return (
    <div className="w-full" style={{ height: 400 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDEDF2" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A8A96" }} tickLine={false} axisLine={{ stroke: "#E5E5EA" }} interval="preserveStartEnd" minTickGap={14} />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#8A8A96" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#8A8A96" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<Tip />} cursor={{ fill: "rgba(139,107,255,0.06)" }} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
          <Bar yAxisId="left" dataKey="signups" name="Signups" fill="#8B6BFF" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Bar yAxisId="left" dataKey="cancels" name="Cancellations" fill="#F43F5E" radius={[3, 3, 0, 0]} maxBarSize={20} />
          <Line yAxisId="right" type="monotone" dataKey="active" name="Active customers" stroke="#101014" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
