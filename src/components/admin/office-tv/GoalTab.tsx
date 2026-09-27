"use client";

import { Sparkles } from "lucide-react";
import { autoGoalTitle, type TvBoardConfig, type TvHeroGoal } from "@/lib/tv-config";
import { fromDateInputValue, toDateInputValue } from "@/lib/datetime";
import type { GoalContext } from "./OfficeTvEditor";

const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const label = "block text-sm font-medium text-gray-700 mb-1";

/** Up to four evenly spaced round-number milestones between now and the target (same as the TV). */
function suggestMilestones(current: number, target: number): number[] {
  if (target <= current) return [target];
  const raw = (target - current) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const step = Math.max(1, Math.round([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw));
  const out: number[] = [];
  for (let n = (Math.floor(current / step) + 1) * step; n < target; n += step) out.push(n);
  return [...out.slice(-3), target];
}

function parseMilestones(text: string, target: number): number[] {
  const nums = text.split(/[^0-9]+/).map(Number).filter((n) => n > 0 && n < target);
  return [...new Set([...nums, target])].sort((a, b) => a - b);
}

export function GoalTab({ config, onChange, context }: { config: TvBoardConfig; onChange: (c: TvBoardConfig) => void; context: GoalContext }) {
  const goal = config.heroGoal;
  const deadlineDay = toDateInputValue(goal.deadline);
  const auto = autoGoalTitle(goal.target, goal.segment, goal.deadline);
  const usingAuto = goal.name === auto;

  const set = (patch: Partial<TvHeroGoal>) => {
    const next = { ...goal, ...patch };
    // Keep the automatic title in step with the target/segment/deadline.
    if (usingAuto) next.name = autoGoalTitle(next.target, next.segment, next.deadline);
    onChange({ ...config, heroGoal: next });
  };

  // Pace hint, like the TV's goal screen.
  const today = new Date(toDateInputValue(new Date()) + "T12:00:00");
  const end = new Date(deadlineDay + "T12:00:00");
  const daysLeft = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  const toGo = Math.max(0, goal.target - context.activeCustomers);
  const need = daysLeft > 0 ? toGo / (daysLeft / 7) : toGo;
  const onPace = context.weeklyPace >= need;

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-3.5">
      <div className="dgs-card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-navy-900">Hero goal</h2>
          <p className="text-sm text-gray-500">The big ring on the Growth board, and the &quot;Goal N / target&quot; readout on the other boards.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={label}>Count</label>
            <select value={goal.segment} onChange={(e) => set({ segment: e.target.value as TvHeroGoal["segment"] })} className={input}>
              <option value="all">All active customers</option>
              <option value="residential">Residential only</option>
              <option value="commercial">Commercial only</option>
            </select>
          </div>
          <div>
            <label className={label}>Target</label>
            <input type="number" min={1} value={goal.target || ""} onChange={(e) => set({ target: Math.max(0, parseInt(e.target.value || "0", 10)) })} className={input} />
          </div>
          <div>
            <label className={label}>By</label>
            <input type="date" value={deadlineDay} onChange={(e) => e.target.value && set({ deadline: fromDateInputValue(e.target.value)! })} className={input} />
          </div>
        </div>

        <div>
          <label className={label}>Milestones</label>
          <div className="flex gap-2">
            <input
              key={goal.milestones.join(",") + goal.target}
              defaultValue={goal.milestones.join(", ")}
              onBlur={(e) => set({ milestones: parseMilestones(e.target.value, goal.target) })}
              placeholder="e.g. 70, 80, 90"
              className={input}
            />
            <button type="button" onClick={() => set({ milestones: suggestMilestones(context.activeCustomers, goal.target) })}
              className="inline-flex items-center gap-1.5 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap">
              <Sparkles className="w-4 h-4" /> Suggest
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {goal.milestones.map((m) => (
              <span key={m} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${m <= context.activeCustomers ? "bg-green-100 text-green-800" : "bg-blue-50 text-blue-800"}`}>
                {m}{m <= context.activeCustomers ? " ✓" : ""}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">The target is always the last milestone. Each one gets a celebration on the TV the day it&apos;s passed.</p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={goal.celebrate} onChange={(e) => set({ celebrate: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
          Celebrate milestones on the TV (confetti)
        </label>

        <div>
          <label className={label}>Title on the board</label>
          <input value={goal.name} onChange={(e) => onChange({ ...config, heroGoal: { ...goal, name: e.target.value } })} className={input} />
          {!usingAuto && (
            <button type="button" onClick={() => onChange({ ...config, heroGoal: { ...goal, name: auto } })} className="text-xs text-teal-700 font-semibold mt-1">
              Use the automatic title: &quot;{auto}&quot;
            </button>
          )}
        </div>
      </div>

      <div className="dgs-card p-6 space-y-3 h-fit">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Where you stand</p>
        <p className="text-3xl font-extrabold text-navy-900">{context.activeCustomers} <span className="text-base font-semibold text-gray-500">of {goal.target || "—"}</span></p>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, goal.target ? (context.activeCustomers / goal.target) * 100 : 0)}%` }} /></div>
        {toGo === 0 ? (
          <p className="text-sm text-green-700 font-semibold">Already reached. Pick a bigger target?</p>
        ) : daysLeft <= 0 ? (
          <p className="text-sm text-red-700">Pick a deadline in the future.</p>
        ) : (
          <p className="text-sm text-gray-700">
            {toGo} to go in {daysLeft} days. You need about <b>{need.toFixed(1)}</b> net new customers a week; the last 8 weeks averaged{" "}
            <b className={onPace ? "text-green-700" : "text-red-700"}>{context.weeklyPace >= 0 ? "+" : "−"}{Math.abs(context.weeklyPace).toFixed(1)}</b>.
          </p>
        )}
        <p className="text-xs text-gray-400">Active customers from the hourly Sweep&amp;Go sync; pace from signups minus cancellations.</p>
      </div>
    </div>
  );
}
