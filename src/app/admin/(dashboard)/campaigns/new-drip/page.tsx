import { DripForm } from "@/components/admin/DripForm";

// ?audience=abandoned_quotes (from the Quote recovery page) preselects that audience.
export default async function NewDripPage({ searchParams }: { searchParams: Promise<{ audience?: string }> }) {
  const { audience } = await searchParams;
  const initial = audience
    ? { name: "", leadTypes: [audience], stopOnReply: true, steps: [{ channel: "sms" as const, subject: "", body: "", delayValue: 0, delayUnit: "days" as const }] }
    : undefined;
  return <DripForm mode="create" initial={initial} />;
}
