import { requireFieldAccess } from "@/lib/auth-supabase";
import { FieldDashboardClient } from "@/components/portals/field/FieldDashboardClient";

export default async function FieldDashboard() {
  const user = await requireFieldAccess();

  return <FieldDashboardClient user={user} />;
}
