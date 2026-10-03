import { winbackCandidates, winbackStatus } from "@/lib/winback";
import { WinbackManager } from "@/components/admin/WinbackManager";

export const dynamic = "force-dynamic";

export default async function WinbackPage() {
  const [status, candidates] = await Promise.all([winbackStatus(), winbackCandidates()]);
  return <WinbackManager status={status} candidates={candidates} />;
}
