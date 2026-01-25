import { requireOfficeAccess } from "@/lib/auth-supabase";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Clock,
  MapPin,
  CreditCard,
  UserPlus,
  Truck,
  XCircle,
} from "lucide-react";

interface DashboardStats {
  activeClients: number;
  newClientsThisMonth: number;
  todaysJobs: number;
  todaysCompleted: number;
  todaysSkipped: number;
  monthlyRevenue: number;
  lastMonthRevenue: number;
  outstandingBalance: number;
  weekCompletionRate: number;
  activeRoutes: number;
}

interface TodaysJob {
  id: string;
  status: string;
  scheduledTime: string | null;
  clientName: string;
  address: string;
  routeName: string | null;
}

interface RecentActivity {
  id: string;
  action: string;
  entityType: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
}

export default async function OfficeDashboard() {
  const user = await requireOfficeAccess();
  const supabase = await createClient();

  // Initialize stats with defaults
  const stats: DashboardStats = {
    activeClients: 0,
    newClientsThisMonth: 0,
    todaysJobs: 0,
    todaysCompleted: 0,
    todaysSkipped: 0,
    monthlyRevenue: 0,
    lastMonthRevenue: 0,
    outstandingBalance: 0,
    weekCompletionRate: 0,
    activeRoutes: 0,
  };

  let todaysJobs: TodaysJob[] = [];
  let recentActivity: RecentActivity[] = [];
  let setupComplete = false;

  try {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Fetch active clients count
    const { count: clientCount } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("status", "ACTIVE");
    stats.activeClients = clientCount || 0;

    // Fetch new clients this month
    const { count: newClientCount } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .gte("created_at", startOfMonth);
    stats.newClientsThisMonth = newClientCount || 0;

    // Fetch today's jobs
    const { count: todayJobCount } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("scheduled_date", today);
    stats.todaysJobs = todayJobCount || 0;

    // Fetch today's completed jobs
    const { count: completedCount } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("scheduled_date", today)
      .eq("status", "COMPLETED");
    stats.todaysCompleted = completedCount || 0;

    // Fetch today's skipped jobs
    const { count: skippedCount } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("scheduled_date", today)
      .eq("status", "SKIPPED");
    stats.todaysSkipped = skippedCount || 0;

    // Fetch monthly revenue from payments
    const { data: monthPayments } = await supabase
      .from("payments")
      .select("amount_cents")
      .eq("org_id", user.orgId)
      .eq("status", "SUCCEEDED")
      .gte("paid_at", startOfMonth) as { data: { amount_cents: number }[] | null };
    stats.monthlyRevenue = (monthPayments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;

    // Fetch last month's revenue for comparison
    const { data: lastMonthPayments } = await supabase
      .from("payments")
      .select("amount_cents")
      .eq("org_id", user.orgId)
      .eq("status", "SUCCEEDED")
      .gte("paid_at", startOfLastMonth)
      .lte("paid_at", endOfLastMonth) as { data: { amount_cents: number }[] | null };
    stats.lastMonthRevenue = (lastMonthPayments || []).reduce((sum, p) => sum + (p.amount_cents || 0), 0) / 100;

    // Fetch outstanding balance from invoices
    const { data: openInvoices } = await supabase
      .from("invoices")
      .select("amount_due_cents")
      .eq("org_id", user.orgId)
      .in("status", ["OPEN", "OVERDUE"]) as { data: { amount_due_cents: number }[] | null };
    stats.outstandingBalance = (openInvoices || []).reduce((sum, i) => sum + (i.amount_due_cents || 0), 0) / 100;

    // Calculate week's completion rate
    const { count: weekTotalJobs } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .gte("scheduled_date", weekAgo)
      .lte("scheduled_date", today);

    const { count: weekCompletedJobs } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .gte("scheduled_date", weekAgo)
      .lte("scheduled_date", today)
      .eq("status", "COMPLETED");

    stats.weekCompletionRate = weekTotalJobs && weekTotalJobs > 0
      ? Math.round(((weekCompletedJobs || 0) / weekTotalJobs) * 100)
      : 0;

    // Fetch active routes today
    const { count: routeCount } = await supabase
      .from("routes")
      .select("*", { count: "exact", head: true })
      .eq("org_id", user.orgId)
      .eq("route_date", today)
      .neq("status", "COMPLETED");
    stats.activeRoutes = routeCount || 0;

    // Fetch today's jobs list
    interface JobData {
      id: string;
      status: string;
      scheduled_time: string | null;
      locations: { address_line1: string; city: string } | null;
      clients: { first_name: string; last_name: string } | null;
      route_stops: Array<{ routes: { name: string } | null }> | null;
    }
    const { data: jobsData } = await supabase
      .from("jobs")
      .select(`
        id,
        status,
        scheduled_time,
        locations!inner(address_line1, city),
        clients!inner(first_name, last_name),
        route_stops(routes(name))
      `)
      .eq("org_id", user.orgId)
      .eq("scheduled_date", today)
      .order("scheduled_time", { ascending: true, nullsFirst: false })
      .limit(10) as { data: JobData[] | null };

    todaysJobs = (jobsData || []).map((job) => ({
      id: job.id,
      status: job.status,
      scheduledTime: job.scheduled_time,
      clientName: `${job.clients?.first_name || ""} ${job.clients?.last_name || ""}`.trim() || "Unknown",
      address: job.locations?.address_line1
        ? `${job.locations.address_line1}, ${job.locations.city || ""}`
        : "No address",
      routeName: job.route_stops?.[0]?.routes?.name || null,
    }));

    // Fetch recent activity
    interface ActivityData {
      id: string;
      action: string;
      entity_type: string;
      details: Record<string, unknown> | null;
      created_at: string;
      users: { first_name: string; last_name: string } | null;
    }
    const { data: activityData } = await supabase
      .from("activity_logs")
      .select(`
        id,
        action,
        entity_type,
        details,
        created_at,
        users(first_name, last_name)
      `)
      .eq("org_id", user.orgId)
      .order("created_at", { ascending: false })
      .limit(5) as { data: ActivityData[] | null };

    recentActivity = (activityData || []).map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entity_type,
      details: a.details,
      createdAt: a.created_at,
      userName: a.users ? `${a.users.first_name || ""} ${a.users.last_name || ""}`.trim() : null,
    }));

    // Check if setup is complete (has clients or jobs)
    setupComplete = stats.activeClients > 0 || stats.todaysJobs > 0;
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  }

  // Calculate revenue change percentage
  const revenueChange = stats.lastMonthRevenue > 0
    ? Math.round(((stats.monthlyRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100)
    : 0;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);

  const formatTime = (time: string | null) => {
    if (!time) return "Unscheduled";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "SKIPPED":
        return "bg-red-100 text-red-800";
      case "SCHEDULED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getActivityIcon = (action: string) => {
    if (action.includes("COMPLETE")) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (action.includes("SKIP") || action.includes("CANCEL")) return <XCircle className="h-5 w-5 text-red-600" />;
    if (action.includes("CREATE") || action.includes("NEW")) return <UserPlus className="h-5 w-5 text-blue-600" />;
    if (action.includes("PAYMENT")) return <CreditCard className="h-5 w-5 text-teal-600" />;
    return <Clock className="h-5 w-5 text-gray-600" />;
  };

  const formatActivityMessage = (activity: RecentActivity) => {
    const action = activity.action.toLowerCase().replace(/_/g, " ");
    const entity = activity.entityType?.toLowerCase().replace(/_/g, " ") || "";
    return `${action} ${entity}`.trim();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {user.firstName || "there"}! Here&apos;s your overview.
          </p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Clients */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 bg-teal-100 rounded-lg">
                <Users className="h-6 w-6 text-teal-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <dt className="truncate text-sm font-medium text-gray-500">Active Clients</dt>
              <dd className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-gray-900">
                  {stats.activeClients.toLocaleString()}
                </span>
                {stats.newClientsThisMonth > 0 && (
                  <span className="text-sm font-medium text-green-600">
                    +{stats.newClientsThisMonth} this month
                  </span>
                )}
              </dd>
            </div>
          </div>
        </div>

        {/* Today's Jobs */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <dt className="truncate text-sm font-medium text-gray-500">Today&apos;s Jobs</dt>
              <dd className="mt-1">
                <span className="text-2xl font-semibold text-gray-900">{stats.todaysJobs}</span>
                <div className="flex gap-2 mt-1 text-xs">
                  <span className="text-green-600">{stats.todaysCompleted} done</span>
                  {stats.todaysSkipped > 0 && (
                    <span className="text-red-600">{stats.todaysSkipped} skipped</span>
                  )}
                  <span className="text-gray-500">
                    {stats.todaysJobs - stats.todaysCompleted - stats.todaysSkipped} remaining
                  </span>
                </div>
              </dd>
            </div>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <dt className="truncate text-sm font-medium text-gray-500">Monthly Revenue</dt>
              <dd className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(stats.monthlyRevenue)}
                </span>
                {revenueChange !== 0 && (
                  <span className={`text-sm font-medium ${revenueChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {revenueChange >= 0 ? "+" : ""}{revenueChange}%
                  </span>
                )}
              </dd>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="ml-4 flex-1">
              <dt className="truncate text-sm font-medium text-gray-500">Completion Rate</dt>
              <dd className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-gray-900">{stats.weekCompletionRate}%</span>
                <span className="text-sm text-gray-500">This week</span>
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Outstanding Balance */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Outstanding Balance</p>
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(stats.outstandingBalance)}</p>
            </div>
            <CreditCard className="h-8 w-8 text-amber-500" />
          </div>
        </div>

        {/* Active Routes */}
        <div className="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Routes Today</p>
              <p className="text-xl font-semibold text-gray-900">{stats.activeRoutes}</p>
            </div>
            <Truck className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        {/* Quick Link to Dispatch */}
        <Link
          href="/app/office/dispatch"
          className="overflow-hidden rounded-lg bg-teal-600 px-4 py-5 shadow sm:p-6 hover:bg-teal-700 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-teal-100">Go to Dispatch</p>
              <p className="text-xl font-semibold text-white">View Live Status</p>
            </div>
            <MapPin className="h-8 w-8 text-white" />
          </div>
        </Link>
      </div>

      {/* Today's Schedule & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Schedule */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Today&apos;s Schedule</h3>
            <Link href="/app/office/scheduling" className="text-sm text-teal-600 hover:text-teal-700">
              View all
            </Link>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {todaysJobs.length > 0 ? (
              <div className="space-y-3">
                {todaysJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-gray-600 w-16">
                        {formatTime(job.scheduledTime)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{job.clientName}</p>
                        <p className="text-sm text-gray-500">{job.address}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs scheduled</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Jobs will appear here once scheduled.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Recent Activity</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {recentActivity.length > 0 ? (
              <div className="flow-root">
                <ul className="-mb-8">
                  {recentActivity.map((activity, idx) => (
                    <li key={activity.id} className="relative pb-8">
                      {idx < recentActivity.length - 1 && (
                        <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                            {getActivityIcon(activity.action)}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div>
                            <p className="text-sm text-gray-700 capitalize">
                              {formatActivityMessage(activity)}
                            </p>
                            {activity.userName && (
                              <p className="text-xs text-gray-500">by {activity.userName}</p>
                            )}
                          </div>
                          <div className="whitespace-nowrap text-right text-sm text-gray-500">
                            {formatTimeAgo(activity.createdAt)}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Activity will be logged as you use the system.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Setup Alert (only show if not set up) */}
      {!setupComplete && (
        <div className="rounded-lg bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Getting Started</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Welcome to the DooGoodScoopers Operations Platform! Start by adding clients
                  and scheduling jobs to see your dashboard come to life.
                </p>
              </div>
              <div className="mt-3 flex gap-3">
                <Link
                  href="/app/office/clients"
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900"
                >
                  Add Clients &rarr;
                </Link>
                <Link
                  href="/app/office/scheduling"
                  className="text-sm font-medium text-yellow-800 hover:text-yellow-900"
                >
                  Schedule Jobs &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
