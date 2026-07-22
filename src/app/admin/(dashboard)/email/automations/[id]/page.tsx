import EmailAutomationForm from "@/components/admin/EmailAutomationForm";

export const dynamic = "force-dynamic";

export default async function EditAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmailAutomationForm automationId={id} />;
}
