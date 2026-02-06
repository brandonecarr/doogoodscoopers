import { requireClientAccess } from "@/lib/auth-supabase";
import { ClientHeader } from "@/components/portals/client/ClientHeader";
import { ClientSidebar } from "@/components/portals/client/ClientSidebar";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClientAccess();

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientSidebar user={user} />
      <div className="lg:pl-64">
        <ClientHeader user={user} />
        <main className="py-6 px-4 sm:px-6 lg:px-8 max-w-[1144px] mx-auto pb-20 lg:pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
