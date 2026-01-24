import { requireOfficeAccess } from "@/lib/auth-supabase";
import { createClient } from "@/lib/supabase/server";
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";

export default async function OfficeDashboard() {
  const user = await requireOfficeAccess();
  const supabase = await createClient();

  // Fetch dashboard stats (placeholder - will be replaced with real queries)
  const stats = {
    activeClients: 0,
    todaysJobs: 0,
    monthlyRevenue: 0,
    completionRate: 0,
  };

  // Try to fetch real data if tables exist
  try {
    const { count: clientCount } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("status", "ACTIVE");

    stats.activeClients = clientCount || 0;

    const today = new Date().toISOString().split("T")[0];
    const { count: jobCount } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("scheduled_date", today);

    stats.todaysJobs = jobCount || 0;
  } catch {
    // Tables may not exist yet - use defaults
  }

  const statCards = [
    {
      name: "Active Clients",
      value: stats.activeClients.toLocaleString(),
      change: "+12%",
      changeType: "positive",
      icon: Users,
    },
    {
      name: "Today's Jobs",
      value: stats.todaysJobs.toString(),
      change: "On track",
      changeType: "neutral",
      icon: Calendar,
    },
    {
      name: "Monthly Revenue",
      value: `$${stats.monthlyRevenue.toLocaleString()}`,
      change: "+8%",
      changeType: "positive",
      icon: DollarSign,
    },
    {
      name: "Completion Rate",
      value: `${stats.completionRate}%`,
      change: "This week",
      changeType: "neutral",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Welcome back, {user.firstName || "there"}! Here&apos;s your overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <stat.icon className="h-8 w-8 text-teal-600" />
              </div>
              <div className="ml-4 flex-1">
                <dt className="truncate text-sm font-medium text-gray-500">
                  {stat.name}
                </dt>
                <dd className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-semibold text-gray-900">
                    {stat.value}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      stat.changeType === "positive"
                        ? "text-green-600"
                        : stat.changeType === "negative"
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {stat.change}
                  </span>
                </dd>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions & Today's Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Today&apos;s Schedule
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No jobs scheduled
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Jobs will appear here once the scheduling system is set up.
              </p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Recent Activity
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="flow-root">
              <ul className="-mb-8">
                <li className="relative pb-8">
                  <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" />
                  <div className="relative flex space-x-3">
                    <div>
                      <span className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center ring-8 ring-white">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                      <div>
                        <p className="text-sm text-gray-500">
                          System initialized
                        </p>
                      </div>
                      <div className="whitespace-nowrap text-right text-sm text-gray-500">
                        <Clock className="inline h-4 w-4 mr-1" />
                        Now
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-lg bg-yellow-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Setup Required
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Welcome to the new DooGoodScoopers Operations Platform. The
                database migration needs to be applied to start using the
                system. Run the seed script to initialize your organization.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
