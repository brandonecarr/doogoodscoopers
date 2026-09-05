import { redirect } from "next/navigation";

export default async function OldCommercialLeadRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/leads/commercial/${id}`);
}
