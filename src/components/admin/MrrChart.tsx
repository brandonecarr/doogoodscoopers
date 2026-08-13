"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import type { GrowthPoint } from "./GrowthChart";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Tip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-hairline bg-white px-3 py-2 shadow-lg text-[12px]">
      <p className="font-semibold text-ink mb-0.5">{label}</p>
      <p className="text-[#16A34A] font-semibold">{money(payload[0].value)}/mo</p>
    </div>
  );
}

export function MrrChart({ data }: { data: GrowthPoint[] }) {
  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 10, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16A34A" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EDEDF2" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A8A96" }} tickLine={false} axisLine={{ stroke: "#E5E5EA" }} interval="preserveStartEnd" minTickGap={14} />
          <YAxis tick={{ fontSize: 11, fill: "#8A8A96" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} />
          <Tooltip content={<Tip />} cursor={{ stroke: "#16A34A", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="mrr" name="Est. MRR" stroke="#16A34A" strokeWidth={2.5} fill="url(#mrrGrad)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
