"use client";

import { AlertTriangle } from "lucide-react";

interface Dog {
  id: string;
  name: string;
  isSafe: boolean;
  safetyNotes: string | null;
}

interface DogWarningBannerProps {
  dogs: Dog[];
}

export function DogWarningBanner({ dogs }: DogWarningBannerProps) {
  const unsafeDogs = dogs.filter((dog) => !dog.isSafe);

  if (unsafeDogs.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-red-800 text-lg">Dog Warning</h4>
          <p className="text-sm text-red-700 mt-1">
            {unsafeDogs.length === 1
              ? `${unsafeDogs[0].name} may not be safe.`
              : `${unsafeDogs.map((d) => d.name).join(", ")} may not be safe.`}
          </p>
          {unsafeDogs.map((dog) =>
            dog.safetyNotes ? (
              <div key={dog.id} className="mt-2 p-2 bg-red-100 rounded-lg">
                <p className="text-xs font-medium text-red-800">{dog.name}:</p>
                <p className="text-sm text-red-700">{dog.safetyNotes}</p>
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
