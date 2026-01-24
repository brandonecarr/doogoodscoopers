import { requireOfficeAccess } from "@/lib/auth-supabase";
import { OfficeHeader } from "@/components/portals/office/OfficeHeader";
import { OfficeSidebar } from "@/components/portals/office/OfficeSidebar";

export default async function OfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireOfficeAccess();

  return (
    <div className="min-h-screen bg-gray-50">
      <OfficeSidebar user={user} />
      <div className="lg:pl-64">
        <OfficeHeader user={user} />
        <main className="py-6 px-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
