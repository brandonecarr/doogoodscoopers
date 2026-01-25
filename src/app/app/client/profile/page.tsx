"use client";

import { useState, useEffect } from "react";
import {
  User,
  MapPin,
  Dog,
  Calendar,
  Edit2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  referralCode: string;
  accountCredit: number;
  memberSince: string;
}

interface Location {
  id: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zipCode: string;
  gateCode: string | null;
  accessNotes: string | null;
}

interface DogInfo {
  id: string;
  name: string;
  breed: string | null;
  isSafe: boolean;
  safetyNotes: string | null;
}

interface Subscription {
  id: string;
  status: string;
  frequency: string;
  pricePerVisit: number;
  preferredDay: string | null;
  nextServiceDate: string | null;
  pausedUntil: string | null;
  planName: string;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [dogs, setDogs] = useState<DogInfo[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/client/profile");
        const data = await res.json();

        if (res.ok) {
          setProfile(data.profile);
          setLocations(data.locations || []);
          setDogs(data.dogs || []);
          setSubscription(data.subscription);
        } else {
          setError(data.error || "Failed to load profile");
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const formatFrequency = (freq: string) => {
    switch (freq) {
      case "WEEKLY":
        return "Weekly";
      case "BIWEEKLY":
        return "Every 2 Weeks";
      case "MONTHLY":
        return "Monthly";
      case "ONETIME":
        return "One-Time";
      default:
        return freq;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">{error || "Profile not found"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <Link
          href="/app/client/settings"
          className="text-teal-600 text-sm font-medium"
        >
          Settings
        </Link>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-xl font-bold">
            {profile.firstName?.[0] || profile.email[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {profile.firstName} {profile.lastName}
            </h2>
            <p className="text-gray-600">{profile.email}</p>
            {profile.phone && <p className="text-gray-600">{profile.phone}</p>}
            <p className="text-sm text-gray-500 mt-1">
              Member since {new Date(profile.memberSince).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Subscription */}
      {subscription && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              Subscription
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                subscription.status === "ACTIVE"
                  ? "bg-green-100 text-green-700"
                  : subscription.status === "PAUSED"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {subscription.status}
            </span>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Plan</span>
              <span className="font-medium">{subscription.planName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Frequency</span>
              <span className="font-medium">{formatFrequency(subscription.frequency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Price</span>
              <span className="font-medium">${(subscription.pricePerVisit / 100).toFixed(2)}/visit</span>
            </div>
            {subscription.preferredDay && (
              <div className="flex justify-between">
                <span className="text-gray-600">Preferred Day</span>
                <span className="font-medium">{subscription.preferredDay}</span>
              </div>
            )}
            {subscription.nextServiceDate && (
              <div className="flex justify-between">
                <span className="text-gray-600">Next Service</span>
                <span className="font-medium">
                  {new Date(subscription.nextServiceDate + "T00:00:00").toLocaleDateString()}
                </span>
              </div>
            )}
            {subscription.pausedUntil && (
              <div className="mt-2 bg-yellow-50 rounded-lg p-3">
                <p className="text-sm text-yellow-700">
                  Paused until {new Date(subscription.pausedUntil).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <Link
              href="/app/client/subscription"
              className="text-teal-600 text-sm font-medium"
            >
              Manage Subscription →
            </Link>
          </div>
        </div>
      )}

      {/* Service Locations */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-teal-600" />
            Service Location{locations.length > 1 ? "s" : ""}
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {locations.map((location) => (
            <Link
              key={location.id}
              href={`/app/client/locations/${location.id}`}
              className="p-4 block hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{location.addressLine1}</p>
                  {location.addressLine2 && (
                    <p className="text-gray-600">{location.addressLine2}</p>
                  )}
                  <p className="text-gray-600">
                    {location.city}, {location.state} {location.zipCode}
                  </p>
                  {location.gateCode && (
                    <p className="text-sm text-gray-500 mt-1">
                      Gate Code: {location.gateCode}
                    </p>
                  )}
                  {location.accessNotes && (
                    <p className="text-sm text-gray-500 mt-1">
                      Notes: {location.accessNotes}
                    </p>
                  )}
                </div>
                <Edit2 className="w-4 h-4 text-gray-400" />
              </div>
            </Link>
          ))}
          {locations.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              No service location on file
            </div>
          )}
        </div>
      </div>

      {/* Dogs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Dog className="w-5 h-5 text-teal-600" />
            Your Dog{dogs.length > 1 ? "s" : ""}
          </h2>
          <Link href="/app/client/dogs/new" className="text-teal-600 text-sm font-medium">
            + Add
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {dogs.map((dog) => (
            <Link
              key={dog.id}
              href={`/app/client/dogs/${dog.id}`}
              className="p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <Dog className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{dog.name}</p>
                  {dog.isSafe ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                </div>
                {dog.breed && <p className="text-sm text-gray-600">{dog.breed}</p>}
                {!dog.isSafe && dog.safetyNotes && (
                  <p className="text-sm text-red-600 mt-1">{dog.safetyNotes}</p>
                )}
              </div>
              <Edit2 className="w-4 h-4 text-gray-400" />
            </Link>
          ))}
          {dogs.length === 0 && (
            <div className="p-4 text-center text-gray-500">No dogs on file</div>
          )}
        </div>
      </div>

      {/* Account Credit */}
      {profile.accountCredit > 0 && (
        <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-medium text-green-800">Account Credit</p>
            <p className="text-sm text-green-700">
              ${(profile.accountCredit / 100).toFixed(2)} available
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
