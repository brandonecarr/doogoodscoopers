"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";

interface StatusCardSmallProps {
  count: number;
  title: string;
  subtitle: string;
  href?: string;
}

export function StatusCardSmall({ count, title, subtitle, href }: StatusCardSmallProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{count}</span>
            <span className="text-sm font-medium text-gray-700">{title}</span>
          </div>
          {href ? (
            <Link href={href} className="text-xs text-teal-600 hover:text-teal-700">
              {subtitle}
            </Link>
          ) : (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
