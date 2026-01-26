"use client";

import { useState } from "react";
import Link from "next/link";

export default function QuickbooksIntegrationPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    // In a real implementation, this would initiate OAuth flow with QuickBooks
    // For now, just show a placeholder message
    setTimeout(() => {
      alert("QuickBooks OAuth integration will be implemented when API credentials are configured.");
      setConnecting(false);
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link href="/app/office/settings" className="text-teal-600 hover:text-teal-700">
          SETTINGS
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-400">QUICKBOOKS ONLINE INTEGRATION</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quickbooks Online Integration</h1>
      </div>

      {/* Integration Card */}
      <section className="bg-white rounded-lg border border-gray-200">
        <div className="flex flex-col items-center justify-center py-16 px-8">
          {/* Puzzle Piece Icons */}
          <div className="flex items-center justify-center mb-8">
            <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Blue puzzle piece (left) */}
              <path
                d="M10 20C10 14.477 14.477 10 20 10H45V25C45 27.761 47.239 30 50 30C52.761 30 55 27.761 55 25V10H55C60.523 10 65 14.477 65 20V45H50C47.239 45 45 47.239 45 50C45 52.761 47.239 55 50 55H65V60C65 65.523 60.523 70 55 70H20C14.477 70 10 65.523 10 60V20Z"
                fill="#0097A7"
              />
              {/* Green puzzle piece (right) */}
              <path
                d="M55 20C55 14.477 59.477 10 65 10H90V25C90 27.761 92.239 30 95 30C97.761 30 100 27.761 100 25V10H100C105.523 10 110 14.477 110 20V45H95C92.239 45 90 47.239 90 50C90 52.761 92.239 55 95 55H110V60C110 65.523 105.523 70 100 70H65C59.477 70 55 65.523 55 60V55H70C72.761 55 75 52.761 75 50C75 47.239 72.761 45 70 45H55V20Z"
                fill="#7DB643"
              />
            </svg>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold text-gray-900 mb-4 text-center">
            Streamline Financial Reporting
          </h2>

          {/* Description */}
          <p className="text-gray-600 text-center max-w-md mb-8">
            Keep your DooGood Scoopers clients, invoices and payments in sync with Quickbooks Online.
          </p>

          {/* Connect Button */}
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-8 py-3 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {connecting ? "Connecting..." : "CONNECT"}
            </button>
          ) : (
            <div className="text-center">
              <div className="flex items-center gap-2 text-green-600 mb-4">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Connected</span>
              </div>
              <button
                onClick={() => setIsConnected(false)}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Disconnect
              </button>
            </div>
          )}

          {/* QuickBooks Logo */}
          <div className="mt-8">
            <svg width="150" height="30" viewBox="0 0 150 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Intuit text */}
              <text x="0" y="10" fontSize="8" fill="#6B7280" fontFamily="Arial, sans-serif">intuit</text>
              {/* QuickBooks text */}
              <text x="0" y="26" fontSize="16" fill="#2CA01C" fontFamily="Arial, sans-serif" fontWeight="bold">quickbooks</text>
              {/* QB icon circle */}
              <circle cx="140" cy="18" r="10" fill="#2CA01C"/>
              <text x="136" y="22" fontSize="10" fill="white" fontFamily="Arial, sans-serif" fontWeight="bold">qb</text>
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
}
