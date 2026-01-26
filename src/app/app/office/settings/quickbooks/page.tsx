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
          {/* QuickBooks Integration Icon */}
          <div className="flex items-center justify-center mb-8">
            <svg width="100" height="60" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Blue/teal connector piece (left) */}
              <path
                d="M0 8C0 3.58172 3.58172 0 8 0H38V0C38 0 38 12 38 18C38 20 40 22 42 22H50V38H42C40 38 38 40 38 42C38 48 38 60 38 60H8C3.58172 60 0 56.4183 0 52V8Z"
                fill="#0097A7"
              />
              {/* Green connector piece (right) */}
              <path
                d="M50 22H58C60 22 62 20 62 18C62 12 62 0 62 0H92C96.4183 0 100 3.58172 100 8V52C100 56.4183 96.4183 60 92 60H62V60C62 60 62 48 62 42C62 40 60 38 58 38H50V22Z"
                fill="#7AB648"
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
