import EmailTemplateEditor from "@/components/admin/EmailTemplateEditor";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmailTemplateEditor templateId={id} />;
}
