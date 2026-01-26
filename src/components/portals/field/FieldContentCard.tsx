"use client";

import { cn } from "@/lib/utils";

interface FieldContentCardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

/**
 * A white card container used throughout the field tech portal
 * Features a gradient top edge and rounded corners
 */
export function FieldContentCard({ children, className, noPadding }: FieldContentCardProps) {
  return (
    <div className={cn("mx-4 -mt-2 relative", className)}>
      {/* Gradient top edge */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-t-xl" />

      {/* Card content */}
      <div className={cn(
        "bg-white rounded-xl shadow-sm",
        !noPadding && "p-4"
      )}>
        {children}
      </div>
    </div>
  );
}

/**
 * Section header within a content card - matches the gradient background look
 */
interface FieldSectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function FieldSectionHeader({ title, subtitle }: FieldSectionHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle && (
        <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
