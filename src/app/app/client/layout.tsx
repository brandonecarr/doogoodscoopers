import { requireClientAccess } from "@/lib/auth-supabase";
import { ClientHeader } from "@/components/portals/client/ClientHeader";
import { ClientBottomNav } from "@/components/portals/client/ClientBottomNav";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClientAccess();

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <ClientHeader user={user} />
      <main className="px-4 py-6 max-w-lg mx-auto">{children}</main>
      <ClientBottomNav />
    </div>
  );
}
