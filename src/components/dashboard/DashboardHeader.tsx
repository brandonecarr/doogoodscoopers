"use client";

export function DashboardHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Overview of your business metrics and activity.
        </p>
      </div>
      {/* Decorative chart graphic */}
      <div className="hidden md:flex items-end gap-1 h-12">
        <div className="w-2 bg-teal-200 rounded-t" style={{ height: "30%" }} />
        <div className="w-2 bg-teal-300 rounded-t" style={{ height: "50%" }} />
        <div className="w-2 bg-teal-400 rounded-t" style={{ height: "40%" }} />
        <div className="w-2 bg-teal-500 rounded-t" style={{ height: "70%" }} />
        <div className="w-2 bg-teal-600 rounded-t" style={{ height: "100%" }} />
        <div className="w-2 bg-teal-500 rounded-t" style={{ height: "80%" }} />
        <div className="w-2 bg-teal-400 rounded-t" style={{ height: "60%" }} />
      </div>
    </div>
  );
}
