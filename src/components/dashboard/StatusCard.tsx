"use client";

import Link from "next/link";

interface StatusCardProps {
  count: number;
  title: string;
  subtitle: string;
  href: string;
  highlight?: boolean;
}

export function StatusCard({ count, title, subtitle, href, highlight = false }: StatusCardProps) {
  const countColor = count > 0 && highlight ? "text-red-600" : "text-gray-900";

  return (
    <Link
      href={href}
      className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <span className={`text-4xl font-bold ${countColor}`}>{count}</span>
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      <span className="text-teal-600 text-sm font-medium flex items-center gap-1">
        VIEW
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
