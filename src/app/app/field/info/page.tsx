"use client";

import { Dog } from "lucide-react";
import { FieldContentCard } from "@/components/portals/field/FieldContentCard";

export default function AppInfoPage() {
  return (
    <FieldContentCard className="mt-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-cyan-50 -mx-4 -mt-4 px-4 py-4 rounded-t-xl mb-4">
        <h2 className="text-lg font-semibold text-gray-900">App Info</h2>
      </div>

      <div className="space-y-6 text-center py-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-teal-500 rounded-full flex items-center justify-center">
            <Dog className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* App Name */}
        <div>
          <h3 className="text-xl font-bold text-gray-900">DooGoodScoopers</h3>
          <p className="text-sm text-gray-500">Field Tech Portal</p>
        </div>

        {/* Version Info */}
        <div className="space-y-2 text-sm text-gray-600">
          <p>Version 2.0.0</p>
          <p>Build 2026.01</p>
        </div>

        {/* Copyright */}
        <div className="pt-8 text-xs text-gray-400">
          <p>Copyright &copy; {new Date().getFullYear()} DooGoodScoopers</p>
          <p className="mt-1">All rights reserved.</p>
        </div>
      </div>
    </FieldContentCard>
  );
}
