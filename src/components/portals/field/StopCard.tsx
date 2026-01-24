"use client";

import { MapPin, AlertTriangle, CheckCircle, Clock, XCircle, Navigation } from "lucide-react";
import Link from "next/link";

interface Dog {
  id: string;
  name: string;
  isSafe: boolean;
}

interface StopCardProps {
  stop: {
    id: string;
    order: number;
    job: {
      id: string;
      status: string;
      client: {
        firstName: string | null;
        lastName: string | null;
      } | null;
      location: {
        addressLine1: string;
        city: string;
        zipCode: string;
      } | null;
      dogs: Dog[];
    } | null;
  };
  isNext?: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  SCHEDULED: { color: "text-gray-500", bg: "bg-gray-100", icon: Clock, label: "Scheduled" },
  EN_ROUTE: { color: "text-blue-600", bg: "bg-blue-100", icon: Navigation, label: "En Route" },
  IN_PROGRESS: { color: "text-yellow-600", bg: "bg-yellow-100", icon: Clock, label: "In Progress" },
  COMPLETED: { color: "text-green-600", bg: "bg-green-100", icon: CheckCircle, label: "Completed" },
  SKIPPED: { color: "text-red-600", bg: "bg-red-100", icon: XCircle, label: "Skipped" },
};

export function StopCard({ stop, isNext = false }: StopCardProps) {
  const { job } = stop;

  if (!job) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.SCHEDULED;
  const StatusIcon = statusConfig.icon;
  const hasUnsafeDog = job.dogs.some((dog) => !dog.isSafe);

  return (
    <Link
      href={`/app/field/route/${stop.id}`}
      className={`block bg-white rounded-xl shadow-sm p-4 ${
        isNext ? "ring-2 ring-teal-500" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Order badge */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isNext ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-600"
        }`}>
          <span className="text-sm font-bold">{stop.order}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Client name */}
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 truncate">
              {job.client
                ? `${job.client.firstName || ""} ${job.client.lastName || ""}`.trim() || "Unknown Client"
                : "Unknown Client"}
            </h3>
            {hasUnsafeDog && (
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
          </div>

          {/* Address */}
          {job.location && (
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {job.location.addressLine1}, {job.location.city}
              </span>
            </div>
          )}

          {/* Dogs */}
          {job.dogs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {job.dogs.map((dog) => (
                <span
                  key={dog.id}
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    dog.isSafe
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {dog.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${statusConfig.bg}`}>
          <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
          <span className={`text-xs font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Next stop indicator */}
      {isNext && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs font-medium text-teal-600 uppercase tracking-wide">
            Next Stop
          </span>
        </div>
      )}
    </Link>
  );
}
