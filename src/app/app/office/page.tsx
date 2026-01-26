import { requireOfficeAccess } from "@/lib/auth-supabase";
import { DashboardClient } from "@/components/dashboard";
import type { DashboardUser } from "@/lib/dashboard/types";

export default async function OfficeDashboard() {
  const user = await requireOfficeAccess();

  const dashboardUser: DashboardUser = {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };

  return <DashboardClient user={dashboardUser} />;
}
