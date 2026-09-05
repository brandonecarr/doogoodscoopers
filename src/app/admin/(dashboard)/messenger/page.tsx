import { Suspense } from "react";
import { MessageCircle } from "lucide-react";
import { PageHero } from "@/components/admin/PageHero";
import { FacebookConnectCard } from "@/components/admin/FacebookConnectCard";
import { MessengerAutoReplyCard } from "@/components/admin/MessengerAutoReplyCard";

export const dynamic = "force-dynamic";

/** Facebook Messenger: connect the Page, then the auto-greeting. Replies happen on each lead's page. */
export default function MessengerSettingsPage() {
  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Facebook Messenger"
        subtitle="Connect your Facebook Page so leads who message it land here and you can reply from their lead page."
        icon={<div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#7CC4FF,#0084FF)" }}><MessageCircle className="w-[22px] h-[22px] text-white" /></div>}
      />
      <Suspense fallback={null}>
        <FacebookConnectCard />
      </Suspense>
      <MessengerAutoReplyCard />
      <div className="dgs-card p-6 text-sm text-gray-600 space-y-2">
        <h2 className="text-lg font-semibold text-navy-900">How it works</h2>
        <p>1. <b>Connect with Facebook</b> above: log in, grant Page access, and choose the Page.</p>
        <p>2. When someone messages the Page, a Facebook lead is created (or matched) and the message shows in that lead&apos;s <b>Messages</b> card.</p>
        <p>3. Open the lead, switch the composer to <b>Facebook Messenger</b>, and reply. Replies are allowed for 7 days after their last message.</p>
      </div>
    </div>
  );
}
