"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Dog, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface DogInfo {
  id: string;
  name: string;
  breed: string | null;
  isSafe: boolean;
  safetyNotes: string | null;
}

export default function EditDogPage() {
  const params = useParams();
  const router = useRouter();
  const dogId = params.id as string;
  const isNew = dogId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [isSafe, setIsSafe] = useState(true);
  const [safetyNotes, setSafetyNotes] = useState("");

  useEffect(() => {
    if (isNew) return;

    async function fetchDog() {
      try {
        const res = await fetch("/api/client/dogs");
        const data = await res.json();

        if (res.ok) {
          const dog = data.dogs.find((d: DogInfo) => d.id === dogId);
          if (dog) {
            setName(dog.name);
            setBreed(dog.breed || "");
            setIsSafe(dog.isSafe);
            setSafetyNotes(dog.safetyNotes || "");
          } else {
            setError("Dog not found");
          }
        } else {
          setError(data.error || "Failed to load dog");
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Failed to load dog");
      } finally {
        setLoading(false);
      }
    }

    fetchDog();
  }, [dogId, isNew]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Dog name is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/client/dogs", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dogId: isNew ? undefined : dogId,
          name: name.trim(),
          breed: breed.trim() || null,
          isSafe,
          safetyNotes: safetyNotes.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(isNew ? "Dog added successfully" : "Dog updated successfully");
        setTimeout(() => router.push("/app/client/profile"), 1500);
      } else {
        setError(data.error || "Failed to save dog");
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to save dog");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/client/dogs?dogId=${dogId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/app/client/profile");
      } else {
        setError(data.error || "Failed to remove dog");
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to remove dog");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/client/profile"
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {isNew ? "Add Dog" : "Edit Dog"}
        </h1>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <Dog className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Dog Information</p>
            <p className="text-sm text-gray-500">Update your dog&apos;s details</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dog's name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Breed
          </label>
          <input
            type="text"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            placeholder="Breed (optional)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isSafe}
              onChange={(e) => setIsSafe(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <div>
              <p className="font-medium text-gray-900">Safe around technicians</p>
              <p className="text-sm text-gray-500">
                Uncheck if your dog may be aggressive or needs to be secured
              </p>
            </div>
          </label>
        </div>

        {!isSafe && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Safety Notes
            </label>
            <textarea
              value={safetyNotes}
              onChange={(e) => setSafetyNotes(e.target.value)}
              rows={3}
              placeholder="Please describe any safety concerns..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-teal-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : isNew ? (
            "Add Dog"
          ) : (
            "Save Changes"
          )}
        </button>

        {!isNew && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full bg-white border border-red-300 text-red-600 py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            Remove Dog
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Dog?</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to remove {name} from your account?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Remove"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
