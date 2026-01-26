"use client";

import { ChevronDown, MoreVertical } from "lucide-react";

interface MetricItem {
  label: string;
  value: string | number;
}

interface MetricCardProps {
  title: string;
  metrics: MetricItem[];
  note?: string;
}

export function MetricCard({ title, metrics, note }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            Current Month
            <ChevronDown className="w-4 h-4" />
          </button>
          <button className="text-gray-400 hover:text-gray-600">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex gap-6">
          {metrics.map((metric, index) => (
            <div key={index}>
              <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
              <p className="text-xl font-bold text-teal-600">{metric.value}</p>
            </div>
          ))}
        </div>
        {note && (
          <p className="text-xs text-gray-400 mt-3">{note}</p>
        )}
      </div>
    </div>
  );
}
