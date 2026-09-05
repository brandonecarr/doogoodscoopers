import { redirect } from "next/navigation";

/** Commercial leads moved under Leads. Keep old links (notifications, activity, habit) working. */
export default async function OldCommercialRedirect({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const { archived } = await searchParams;
  redirect(archived === "true" ? "/admin/leads/commercial?archived=true" : "/admin/leads/commercial");
}
