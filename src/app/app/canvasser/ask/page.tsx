import { redirect } from "next/navigation";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import { CanvasserAsk } from "@/components/portals/canvasser/CanvasserAsk";
import { isAskCanvasserConfigured } from "@/lib/ask-canvasser";

export const dynamic = "force-dynamic";

export default async function CanvasserAskPage() {
  const session = await getCanvasserSession();
  if (!session) redirect("/canvasser/login");

  return (
    <div className="space-y-2.5">
      <h1 className="text-[16px] font-extrabold text-gray-900 px-1">Coach</h1>
      {isAskCanvasserConfigured() ? (
        <CanvasserAsk />
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
          <p className="text-[13.5px] text-gray-500">The AI coach isn&apos;t set up yet.</p>
        </div>
      )}
    </div>
  );
}
