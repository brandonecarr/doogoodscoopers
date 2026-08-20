import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import { getSession } from "@/lib/auth";
import { PageHero } from "@/components/admin/PageHero";
import { AskChat } from "@/components/admin/ask/AskChat";
import { isAskDgsConfigured } from "@/lib/ask-dgs";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Ask DGS"
        subtitle="Your AI ops analyst — ask anything about your leads, customers, revenue, and reviews, answered from live data"
        icon={
          <div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
            <Bot className="w-[22px] h-[22px] text-white" />
          </div>
        }
      />

      {isAskDgsConfigured() ? (
        <AskChat />
      ) : (
        <div className="dgs-card p-8 text-center">
          <Bot className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-[13.5px] text-muted">Ask DGS needs an <code>ANTHROPIC_API_KEY</code> set in the environment (Vercel) to run. Add it and reload.</p>
        </div>
      )}
    </div>
  );
}
