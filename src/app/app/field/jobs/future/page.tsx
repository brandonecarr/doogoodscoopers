"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MapPin, PersonStanding, Clock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  clientName: string;
  address: string;
  numberOfDogs: number;
  frequency: string;
  estimatedTime: number;
  hasAdditionalServices: boolean;
  date: string;
}

export default function FutureJobsPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchJobs = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = date.toISOString().split("T")[0];
      const res = await fetch(`/api/field/jobs/future?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(selectedDate);
  }, [fetchJobs, selectedDate]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-CA"); // YYYY/MM/DD format
  };

  const openDirections = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://maps.google.com/?daddr=${encodedAddress}`, "_blank");
  };

  // Simple date picker navigation
  const prevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const nextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  return (
    <div className="mt-4">
      {/* Date Selector */}
      <div className="px-4 mb-4">
        <div className="bg-teal-600 text-white py-2 px-4 rounded-lg flex items-center justify-between">
          <button onClick={prevDay} className="p-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="font-medium"
          >
            {formatDate(selectedDate)}
          </button>
          <button onClick={nextDay} className="p-1">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      ) : jobs.length === 0 ? (
        <FieldContentCard>
          <div className="py-12 text-center">
            <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">No jobs scheduled for this date</p>
          </div>
        </FieldContentCard>
      ) : (
        <div className="space-y-4 px-4">
          {jobs.map((job, index) => (
            <div key={job.id} className="relative">
              {/* Order number */}
              <div className="absolute -left-2 top-4 w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm z-10">
                {index + 1}
              </div>

              <FieldContentCard className="ml-4 !mx-0">
                {/* Job Header Icons */}
                <div className="flex justify-end gap-3 mb-2">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <PersonStanding className="w-4 h-4 text-teal-600" />
                    <span>{job.estimatedTime} min</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Clock className="w-4 h-4 text-green-600" />
                    <span>{job.frequency}</span>
                  </div>
                  {job.hasAdditionalServices && (
                    <div className="px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded">
                      MORE SERVICES
                    </div>
                  )}
                </div>

                {/* Client Info */}
                <div className="mb-3">
                  <p className="text-xs text-gray-500 uppercase">CLIENT</p>
                  <h3 className="text-lg font-semibold text-gray-900">{job.clientName}</h3>
                </div>

                {/* Address and Directions */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">ADDRESS</p>
                    <p className="text-sm text-gray-700">{job.address}</p>
                    <button className="text-teal-600 text-sm font-medium mt-1">
                      MORE INFO
                    </button>
                  </div>
                  <button
                    onClick={() => openDirections(job.address)}
                    className="flex items-center gap-1 px-3 py-2 border border-teal-500 text-teal-600 rounded-lg text-sm font-medium"
                  >
                    <MapPin className="w-4 h-4" />
                    DIRECTIONS
                  </button>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-3" />

                {/* Dogs */}
                <div>
                  <p className="text-xs text-gray-500 uppercase">NUMBER OF DOGS</p>
                  <p className="text-gray-900">{job.numberOfDogs}</p>
                </div>
              </FieldContentCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
