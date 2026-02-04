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
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900">{count}</span>
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>
        <p className="text-xs text-teal-600">{subtitle}</p>
      </div>
      <span className="text-gray-400">
        <MoreVertical className="w-4 h-4" />
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="bg-white rounded-lg border border-gray-200 p-4 block hover:border-teal-300 hover:shadow-sm transition-all">
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {content}
    </div>
  );
}
