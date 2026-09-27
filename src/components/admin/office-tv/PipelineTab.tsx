"use client";

import { Plus, Trash2, ArrowUp, ArrowDown, Trophy } from "lucide-react";
import { LEAD_STATUSES, type TvBoardConfig, type TvPipeline, type TvPipelineStage } from "@/lib/tv-config";

const input = "w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm";

/** Pipeline stages, and which lead statuses count toward each. */
export function PipelineTab({ config, onChange }: { config: TvBoardConfig; onChange: (c: TvBoardConfig) => void }) {
  const setPipeline = (i: number, next: TvPipeline) => onChange({ ...config, pipelines: config.pipelines.map((p, j) => (j === i ? next : p)) });

  return (
    <div className="space-y-3.5">
      {config.pipelines.map((pipeline, pi) => {
        const setStages = (stages: TvPipelineStage[]) => setPipeline(pi, { ...pipeline, stages });
        const setStage = (si: number, patch: Partial<TvPipelineStage>) => setStages(pipeline.stages.map((s, j) => (j === si ? { ...s, ...patch } : s)));
        const unassigned = LEAD_STATUSES.filter((l) => !pipeline.stages.some((s) => s.sourceStatuses.includes(l.value)));

        // A status belongs to one stage; picking it here takes it off any other.
        const toggleStatus = (si: number, status: string) => setStages(pipeline.stages.map((s, j) => {
          const has = s.sourceStatuses.includes(status);
          if (j === si) return { ...s, sourceStatuses: has ? s.sourceStatuses.filter((x) => x !== status) : [...s.sourceStatuses, status] };
          return has ? { ...s, sourceStatuses: s.sourceStatuses.filter((x) => x !== status) } : s;
        }));
        const move = (si: number, delta: number) => {
          const to = si + delta;
          if (to < 0 || to >= pipeline.stages.length) return;
          const stages = [...pipeline.stages];
          [stages[si], stages[to]] = [stages[to], stages[si]];
          setStages(stages);
        };

        return (
          <div key={pipeline.id} className="dgs-card p-6 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-navy-900">Pipeline stages</h2>
                <p className="text-sm text-gray-500">Used by the pipeline sections and the funnel (&quot;Quoted&quot; there = the second stage onward). The TV shows the first four stages.</p>
              </div>
            </div>

            <div className="space-y-3">
              {pipeline.stages.map((stage, si) => (
                <div key={stage.id} className={`rounded-xl border p-4 ${stage.isWon ? "border-blue-300 bg-blue-50/50" : "border-gray-200"} ${si >= 4 ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-6 text-sm font-bold text-gray-400">{si + 1}</span>
                    <input value={stage.name} onChange={(e) => setStage(si, { name: e.target.value })} placeholder="Stage name" className={`${input} flex-1 min-w-[140px]`} />
                    <input value={stage.shortName ?? ""} onChange={(e) => setStage(si, { shortName: e.target.value || undefined })} placeholder="Short name (optional)" title="Used in narrow columns, e.g. '1st visit'" className={`${input} w-44`} />
                    <button onClick={() => setStages(pipeline.stages.map((s, j) => ({ ...s, isWon: j === si ? !s.isWon : false })))}
                      title="The won stage is highlighted in blue" className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border ${stage.isWon ? "bg-blue-600 border-blue-600 text-white" : "border-gray-200 text-gray-600"}`}>
                      <Trophy className="w-3.5 h-3.5" /> Won
                    </button>
                    <button onClick={() => move(si, -1)} className="p-2 rounded border border-gray-200"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => move(si, 1)} className="p-2 rounded border border-gray-200"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setStages(pipeline.stages.filter((_, j) => j !== si))} disabled={pipeline.stages.length <= 1} className="p-2 rounded border border-red-200 text-red-600 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3 pl-8">
                    {LEAD_STATUSES.map((l) => {
                      const on = stage.sourceStatuses.includes(l.value);
                      return (
                        <button key={l.value} onClick={() => toggleStatus(si, l.value)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${on ? "bg-teal-600 border-teal-600 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-teal-300"}`}>
                          {l.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button onClick={() => setStages([...pipeline.stages, { id: `stage-${Math.random().toString(36).slice(2, 7)}`, name: "", sourceStatuses: [], isWon: false }])}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-teal-400 text-sm font-semibold text-teal-700 hover:bg-teal-50">
                <Plus className="w-4 h-4" /> Add stage
              </button>
              {unassigned.length > 0 && <p className="text-xs text-gray-500">Not shown on the TV: {unassigned.map((l) => l.label).join(", ")}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
