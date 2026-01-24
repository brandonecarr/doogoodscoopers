import { requireClientAccess } from "@/lib/auth-supabase";
import { Calendar, CreditCard, Share2, Dog, CheckCircle } from "lucide-react";
import Link from "next/link";

export default async function ClientDashboard() {
  const user = await requireClientAccess();

  // Placeholder data - will be replaced with real queries
  const nextService = null;
  const accountBalance = 0;
  const referralCredits = 0;

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">
          Hi, {user.firstName || "there"}!
        </h1>
        <p className="text-teal-100 text-sm">
          Welcome to your DooGoodScoopers account
        </p>
      </div>

      {/* Next Service */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-teal-600" />
          Next Service
        </h2>

        {nextService ? (
          <div className="bg-teal-50 rounded-lg p-4">
            <p className="font-medium text-teal-900">Monday, January 27</p>
            <p className="text-sm text-teal-700">Scheduled window: 9AM - 12PM</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <Dog className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No upcoming service scheduled</p>
            <p className="text-gray-400 text-xs mt-1">
              Your next service will appear here
            </p>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Balance</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${accountBalance.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Share2 className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Referral Credit</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${referralCredits.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
        <Link
          href="/app/client/schedule"
          className="flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
              <Calendar className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">View Schedule</p>
              <p className="text-sm text-gray-500">See upcoming services</p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </Link>

        <Link
          href="/app/client/billing"
          className="flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Billing & Payments</p>
              <p className="text-sm text-gray-500">Manage payment methods</p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </Link>

        <Link
          href="/app/client/referrals"
          className="flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Share2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Refer a Friend</p>
              <p className="text-sm text-gray-500">Earn $25 per referral</p>
            </div>
          </div>
          <span className="text-gray-400">→</span>
        </Link>
      </div>

      {/* Success Message */}
      <div className="bg-green-50 rounded-xl p-4 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-green-800">Account Active</p>
          <p className="text-xs text-green-700 mt-1">
            Your account is set up and ready. Service details will appear once scheduled.
          </p>
        </div>
      </div>
    </div>
  );
}
