"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Navigation,
  MessageSquare,
  Phone,
  ChevronDown,
  CheckCheck,
} from "lucide-react";
import Link from "next/link";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  cellPhone: string | null;
  homePhone: string | null;
  relationship: string | null;
  isPrimary: boolean;
}

interface Dog {
  id: string;
  name: string;
  breed: string | null;
  size: string | null;
  color: string | null;
  isSafe: boolean;
  safetyNotes: string | null;
  specialInstructions: string | null;
}

interface AdditionalService {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
}

interface RecentCleanup {
  id: string;
  date: string;
  status: string;
  completedAt: string | null;
  techName: string | null;
}

interface ClientInfo {
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  location: {
    id: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    zipCode: string;
    lat: number | null;
    lng: number | null;
    gateCode: string | null;
    gateLocation: string | null;
    accessNotes: string | null;
    serviceAreas: string[] | null;
  } | null;
  jobNotes: string | null;
  contacts: Contact[];
  dogs: Dog[];
  additionalServices: AdditionalService[];
  recentCleanups: RecentCleanup[];
}

function DogIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
      <ellipse cx="12" cy="14" rx="2" ry="1.5" fill="currentColor" />
      <path d="M6 6 L4 3" strokeLinecap="round" />
      <path d="M18 6 L20 3" strokeLinecap="round" />
    </svg>
  );
}

export default function ClientInfoPage() {
  const params = useParams();
  const stopId = params.stopId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<ClientInfo | null>(null);
  const [activeContactTab, setActiveContactTab] = useState(0);
  const [expandedDogs, setExpandedDogs] = useState<Set<string>>(new Set());

  const fetchInfo = useCallback(async () => {
    try {
      // First get route to find the job ID for this stop
      const routeRes = await fetch("/api/field/route");
      const routeData = await routeRes.json();

      if (!routeRes.ok) {
        setError(routeData.error || "Failed to load route");
        return;
      }

      const stop = routeData.stops?.find((s: { id: string }) => s.id === stopId);
      if (!stop || !stop.job) {
        setError("Stop not found");
        return;
      }

      // Get full client info
      const infoRes = await fetch(`/api/field/job/${stop.job.id}/info`);
      const infoData = await infoRes.json();

      if (infoRes.ok) {
        setInfo(infoData);
      } else {
        setError(infoData.error || "Failed to load client info");
      }
    } catch (err) {
      console.error("Error fetching info:", err);
      setError("Failed to load client info");
    } finally {
      setLoading(false);
    }
  }, [stopId]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  const openDirections = () => {
    if (!info?.location) return;
    const address = encodeURIComponent(
      `${info.location.addressLine1}, ${info.location.city}, ${info.location.state} ${info.location.zipCode}`
    );
    const url =
      info.location.lat && info.location.lng
        ? `https://maps.google.com/?daddr=${info.location.lat},${info.location.lng}`
        : `https://maps.google.com/?daddr=${address}`;
    window.open(url, "_blank");
  };

  const toggleDogExpanded = (dogId: string) => {
    setExpandedDogs((prev) => {
      const next = new Set(prev);
      if (next.has(dogId)) {
        next.delete(dogId);
      } else {
        next.add(dogId);
      }
      return next;
    });
  };

  const clientName = info?.client
    ? `${info.client.firstName || ""} ${info.client.lastName || ""}`.trim()
    : "Unknown Client";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="p-4 space-y-4">
        <Link
          href={`/app/field/route/${stopId}`}
          className="flex items-center gap-2 text-gray-600"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Job
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error || "Info not found"}</p>
        </div>
      </div>
    );
  }

  const activeContact = info.contacts[activeContactTab] || info.contacts[0];

  return (
    <div className="pb-8 space-y-4">
      {/* CLIENT AND LOCATION INFO */}
      <FieldContentCard className="mt-4">
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-3 rounded-t-xl">
          <h2 className="text-sm font-semibold text-gray-700 tracking-wide">
            CLIENT AND LOCATION INFO
          </h2>
        </div>

        <div className="pt-4 space-y-4">
          {/* Client Name */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">CLIENT</p>
            <p className="text-2xl font-bold text-gray-900">{clientName}</p>
          </div>

          {/* Address with Directions */}
          {info.location && (
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">ADDRESS</p>
                <p className="text-gray-900">
                  {info.location.addressLine1}
                  {info.location.addressLine2 && ` ${info.location.addressLine2}`}
                </p>
              </div>
              <button
                onClick={openDirections}
                className="flex items-center gap-2 px-4 py-2 border-2 border-teal-500 text-teal-600 rounded-lg text-sm font-semibold flex-shrink-0"
              >
                <Navigation className="w-4 h-4" />
                DIRECTIONS
              </button>
            </div>
          )}

          {/* City */}
          {info.location && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">CITY</p>
              <p className="text-gray-900">{info.location.city}</p>
            </div>
          )}

          {/* Zip Code */}
          {info.location && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">ZIP CODE</p>
              <p className="text-gray-900">{info.location.zipCode}</p>
            </div>
          )}
        </div>
      </FieldContentCard>

      {/* CONTACT INFO */}
      {info.contacts.length > 0 && (
        <FieldContentCard>
          <div className="-mx-4 -mt-4 px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 tracking-wide">
              CONTACT INFO
            </h2>
          </div>

          {/* Contact Tabs */}
          {info.contacts.length > 1 && (
            <div className="flex border-b border-gray-200 -mx-4 px-4 mt-2">
              {info.contacts.map((contact, index) => (
                <button
                  key={contact.id}
                  onClick={() => setActiveContactTab(index)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeContactTab === index
                      ? "text-teal-600 border-teal-600"
                      : "text-gray-500 border-transparent hover:text-gray-700"
                  }`}
                >
                  CONTACT #{index + 1}
                </button>
              ))}
            </div>
          )}

          {activeContact && (
            <div className="pt-4 space-y-4">
              {/* Name */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">NAME</p>
                <p className="text-gray-900">
                  {`${activeContact.firstName || ""} ${activeContact.lastName || ""}`.trim() ||
                    "No data"}
                </p>
              </div>

              {/* Cell Phone */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">CELL PHONE</p>
                <p className="text-gray-900 mb-2">
                  {activeContact.cellPhone || "No data"}
                </p>
                {activeContact.cellPhone && (
                  <div className="flex gap-2">
                    <a
                      href={`sms:${activeContact.cellPhone}`}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-teal-500 text-teal-600 rounded-lg text-sm font-semibold"
                    >
                      <MessageSquare className="w-4 h-4" />
                      TEXT
                    </a>
                    <a
                      href={`tel:${activeContact.cellPhone}`}
                      className="flex items-center gap-2 px-4 py-2 border-2 border-teal-500 text-teal-600 rounded-lg text-sm font-semibold"
                    >
                      <Phone className="w-4 h-4" />
                      CALL
                    </a>
                  </div>
                )}
              </div>

              {/* Home Phone */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">HOME PHONE</p>
                <p className="text-gray-900">{activeContact.homePhone || "No data"}</p>
              </div>

              {/* Email */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">EMAIL</p>
                <p className="text-gray-900">{activeContact.email || "No data"}</p>
              </div>
            </div>
          )}
        </FieldContentCard>
      )}

      {/* YARD AND ACCESS INFO */}
      <FieldContentCard>
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-3 rounded-t-xl">
          <h2 className="text-sm font-semibold text-gray-700 tracking-wide">
            YARD AND ACCESS INFO
          </h2>
        </div>

        <div className="pt-4 space-y-4">
          {/* Gate Location */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">GATE LOCATION</p>
            <p className="text-gray-900">{info.location?.gateLocation || "No data"}</p>
          </div>

          {/* Gate Code */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">GATE CODE</p>
            <p className="text-gray-900">{info.location?.gateCode || "No data"}</p>
          </div>

          {/* Areas to Clean */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">AREAS TO CLEAN</p>
            <p className="text-gray-900">
              {info.location?.serviceAreas && info.location.serviceAreas.length > 0
                ? info.location.serviceAreas.join(", ")
                : "No data"}
            </p>
          </div>

          {/* Access Notes */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">ACCESS NOTES</p>
            <p className="text-gray-900">{info.location?.accessNotes || "No data"}</p>
          </div>

          {/* Job Notes */}
          {info.jobNotes && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">JOB NOTES</p>
              <p className="text-gray-900">{info.jobNotes}</p>
            </div>
          )}
        </div>
      </FieldContentCard>

      {/* ADDITIONAL SERVICES */}
      {info.additionalServices.length > 0 && (
        <FieldContentCard>
          <div className="-mx-4 -mt-4 px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 tracking-wide">
              ADDITIONAL SERVICES
            </h2>
          </div>

          <div className="pt-4 divide-y divide-gray-100">
            {info.additionalServices.map((service) => (
              <div key={service.id} className="py-3 first:pt-0 last:pb-0">
                <p className="font-semibold text-gray-900">{service.name}</p>
                {service.description && (
                  <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                )}
              </div>
            ))}
          </div>
        </FieldContentCard>
      )}

      {/* DOG INFO */}
      {info.dogs.length > 0 && (
        <FieldContentCard>
          <div className="-mx-4 -mt-4 px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 tracking-wide">DOG INFO</h2>
          </div>

          <div className="pt-2 divide-y divide-gray-100">
            {info.dogs.map((dog) => (
              <div key={dog.id} className="py-3">
                <button
                  onClick={() => toggleDogExpanded(dog.id)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                      <DogIcon className="w-6 h-6 text-teal-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">NAME</p>
                      <p className="font-medium text-gray-900">{dog.name}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedDogs.has(dog.id) ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {expandedDogs.has(dog.id) && (
                  <div className="mt-3 ml-13 pl-13 space-y-2 text-sm">
                    {dog.breed && (
                      <div>
                        <span className="text-gray-500">Breed:</span>{" "}
                        <span className="text-gray-900">{dog.breed}</span>
                      </div>
                    )}
                    {dog.color && (
                      <div>
                        <span className="text-gray-500">Color:</span>{" "}
                        <span className="text-gray-900">{dog.color}</span>
                      </div>
                    )}
                    {dog.size && (
                      <div>
                        <span className="text-gray-500">Size:</span>{" "}
                        <span className="text-gray-900">{dog.size}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Safe:</span>{" "}
                      <span
                        className={dog.isSafe ? "text-green-600" : "text-red-600"}
                      >
                        {dog.isSafe ? "Yes" : "No"}
                      </span>
                    </div>
                    {dog.safetyNotes && (
                      <div>
                        <span className="text-gray-500">Safety Notes:</span>{" "}
                        <span className="text-gray-900">{dog.safetyNotes}</span>
                      </div>
                    )}
                    {dog.specialInstructions && (
                      <div>
                        <span className="text-gray-500">Special Instructions:</span>{" "}
                        <span className="text-gray-900">{dog.specialInstructions}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </FieldContentCard>
      )}

      {/* RECENT CLEANUPS */}
      {info.recentCleanups.length > 0 && (
        <FieldContentCard>
          <div className="-mx-4 -mt-4 px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700 tracking-wide">
              RECENT CLEANUPS
            </h2>
          </div>

          <div className="pt-4 divide-y divide-gray-100">
            {info.recentCleanups.map((cleanup) => (
              <div key={cleanup.id} className="py-4 first:pt-0 last:pb-0">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">DATE</p>
                    <p className="text-gray-900">{cleanup.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">TECH</p>
                    <p className="text-gray-900">{cleanup.techName || "Unknown"}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">STATUS</p>
                  <p
                    className={`flex items-center gap-1 font-medium ${
                      cleanup.status === "COMPLETED" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {cleanup.status === "COMPLETED" && (
                      <CheckCheck className="w-4 h-4" />
                    )}
                    {cleanup.status === "COMPLETED" ? "Completed" : "Skipped"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </FieldContentCard>
      )}
    </div>
  );
}
