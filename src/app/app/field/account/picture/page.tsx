"use client";

import { useState, useRef } from "react";
import { User } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";

export default function ProfilePicturePage() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to server
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/field/account/picture", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload image");
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setProfileImage(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);

    try {
      const res = await fetch("/api/field/account/picture", {
        method: "DELETE",
      });

      if (res.ok) {
        setProfileImage(null);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove image");
      }
    } catch (err) {
      console.error("Error removing image:", err);
      setError(err instanceof Error ? err.message : "Failed to remove image");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <FieldContentCard className="mt-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Profile Picture</h2>
      </div>

      <div className="space-y-6">
        {/* Profile Picture Display */}
        <div className="flex justify-center">
          <div className="relative">
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                className="w-40 h-40 rounded-full object-cover border-4 border-gray-200"
              />
            ) : (
              <div className="w-40 h-40 rounded-full bg-gray-100 border-4 border-gray-200 flex items-center justify-center">
                <User className="w-20 h-20 text-gray-400" />
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 py-3 border-2 border-teal-500 text-teal-600 font-semibold rounded-lg hover:bg-teal-50 disabled:opacity-50 transition-colors"
          >
            {uploading ? "Uploading..." : "Change Picture"}
          </button>
          <button
            onClick={handleRemove}
            disabled={removing || !profileImage}
            className="flex-1 py-3 border-2 border-red-500 text-red-600 font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {removing ? "Removing..." : "Remove Picture"}
          </button>
        </div>
      </div>
    </FieldContentCard>
  );
}
