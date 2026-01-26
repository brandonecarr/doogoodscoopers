"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, MoreVertical } from "lucide-react";

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  info?: ReactNode;
}

export function ChartContainer({ title, children, info }: ChartContainerProps) {
  const [periodOpen, setPeriodOpen] = useState(false);

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
          <div className="relative">
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            >
              Current Month
              <ChevronDown className="w-4 h-4" />
            </button>
            {periodOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPeriodOpen(false)} />
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => setPeriodOpen(false)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Current Month
                  </button>
                  <button
                    onClick={() => setPeriodOpen(false)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Last Month
                  </button>
                  <button
                    onClick={() => setPeriodOpen(false)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Last 3 Months
                  </button>
                </div>
              </>
            )}
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
      {info && (
        <div className="px-4 pt-3">
          {info}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
