import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { AdminPushProvider } from "@/components/admin/AdminPushProvider";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="dgs-admin min-h-screen">
      <AdminPushProvider />
      <div className="mx-auto max-w-[1600px] px-3 sm:px-[18px] pt-[10px] sm:pt-[18px] pb-24 lg:pb-10">
        <AdminTopNav email={session.email} />
        <main>{children}</main>
      </div>
    </div>
  );
}
