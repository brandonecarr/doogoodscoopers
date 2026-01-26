"use client";

import { MapPin, AlertTriangle, CheckCircle, XCircle, PersonStanding, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
      estimatedTime?: number;
      frequency?: string;
      client: {
        firstName: string | null;
        lastName: string | null;
      } | null;
      location: {
        addressLine1: string;
        addressLine2?: string | null;
        city: string;
        state?: string;
        zipCode: string;
        gateCode?: string | null;
      } | null;
      dogs: Dog[];
      hasAdditionalServices?: boolean;
    } | null;
  };
  isNext?: boolean;
}

export function StopCard({ stop, isNext = false }: StopCardProps) {
  const router = useRouter();
  const { job } = stop;

  if (!job) {
    return null;
  }

  const hasUnsafeDog = job.dogs.some((dog) => !dog.isSafe);
  const clientName = job.client
    ? `${job.client.firstName || ""} ${job.client.lastName || ""}`.trim() || "Unknown Client"
    : "Unknown Client";
  const fullAddress = job.location
    ? `${job.location.addressLine1}${job.location.addressLine2 ? ` ${job.location.addressLine2}` : ""}`
    : "";

  const isCompleted = job.status === "COMPLETED";
  const isSkipped = job.status === "SKIPPED";

  const openDirections = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (job.location) {
      const address = `${job.location.addressLine1}, ${job.location.city}, ${job.location.state || ""} ${job.location.zipCode}`;
      const encodedAddress = encodeURIComponent(address);
      window.open(`https://maps.google.com/?daddr=${encodedAddress}`, "_blank");
    }
  };

  return (
    <div className="relative">
      {/* Order number badge - positioned outside the card */}
      <div
        className={cn(
          "absolute -left-2 top-4 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm z-10",
          isNext ? "bg-teal-600" : isCompleted ? "bg-green-600" : isSkipped ? "bg-red-600" : "bg-teal-500"
        )}
      >
        {stop.order}
      </div>

      <Link
        href={`/app/field/route/${stop.id}`}
        className={cn(
          "block bg-white rounded-xl shadow-sm ml-4 overflow-hidden",
          isNext && "ring-2 ring-teal-500"
        )}
      >
        {/* Card Header with Icons */}
        <div className="flex justify-end items-center gap-2 px-4 pt-3">
          {job.estimatedTime && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <PersonStanding className="w-4 h-4 text-teal-600" />
              <span>{job.estimatedTime} min</span>
            </div>
          )}
          {job.frequency && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Clock className="w-4 h-4 text-green-600" />
              <span>{job.frequency}</span>
            </div>
          )}
          {hasUnsafeDog && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">
              <AlertTriangle className="w-3 h-3" />
              <span>UNSAFE DOGS</span>
            </div>
          )}
          {job.hasAdditionalServices && (
            <div className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded">
              MORE SERVICES
            </div>
          )}
        </div>

        {/* Client Info */}
        <div className="px-4 py-2">
          <p className="text-xs text-gray-500 uppercase">CLIENT</p>
          <h3 className="text-lg font-semibold text-gray-900">{clientName}</h3>
        </div>

        {/* Address and Directions */}
        <div className="px-4 py-2 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase">ADDRESS</p>
            <p className="text-sm text-gray-700">{fullAddress}</p>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/app/field/route/${stop.id}/info`);
              }}
              className="text-teal-600 text-sm font-medium mt-1"
            >
              MORE INFO
            </button>
          </div>
          <button
            onClick={openDirections}
            className="flex items-center gap-1 px-3 py-2 border border-teal-500 text-teal-600 rounded-lg text-sm font-medium ml-3 flex-shrink-0"
          >
            <MapPin className="w-4 h-4" />
            DIRECTIONS
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mx-4 my-2" />

        {/* Bottom Info Row */}
        <div className="px-4 pb-4 flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase">NUMBER OF DOGS</p>
            <p className="text-gray-900">{job.dogs.length}</p>
          </div>
          {job.location?.gateCode && (
            <div>
              <p className="text-xs text-gray-500 uppercase">GATE CODE</p>
              <p className="text-gray-900">{job.location.gateCode}</p>
            </div>
          )}
          <div className="ml-auto">
            <p className="text-xs text-gray-500 uppercase">STATUS</p>
            <div className="flex items-center gap-1">
              {isCompleted ? (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-green-600 font-medium">COMPLETED</span>
                </>
              ) : isSkipped ? (
                <>
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 font-medium">SKIPPED</span>
                </>
              ) : (
                <span className="text-gray-600">Pending</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
