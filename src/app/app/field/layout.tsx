import { requireFieldAccess } from "@/lib/auth-supabase";
import { FieldHeader } from "@/components/portals/field/FieldHeader";
import { FieldBottomNav } from "@/components/portals/field/FieldBottomNav";
import { PWAProvider } from "@/components/portals/field/PWAProvider";

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireFieldAccess();

  return (
    <PWAProvider>
      <div className="min-h-screen bg-gray-100 pb-16">
        <FieldHeader user={user} />
        <main className="px-4 py-4">{children}</main>
        <FieldBottomNav />
      </div>
    </PWAProvider>
  );
}
