import type { Metadata } from "next";
import { requireFieldAccess } from "@/lib/auth-supabase";
import { PWAProvider } from "@/components/portals/field/PWAProvider";
import { FieldLayoutClient } from "@/components/portals/field/FieldLayoutClient";

export const metadata: Metadata = {
  manifest: "/manifest.json",
};

export default async function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireFieldAccess();

  return (
    <PWAProvider>
      <FieldLayoutClient user={user}>
        {children}
      </FieldLayoutClient>
    </PWAProvider>
  );
}
