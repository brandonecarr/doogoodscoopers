import Link from "next/link";
import { MapPin } from "lucide-react";
import { canvasserForInvite } from "@/lib/canvasser-auth";
import { SetPasswordForm } from "@/components/portals/canvasser/SetPasswordForm";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const invite = token ? await canvasserForInvite(token) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0E2A47] px-5">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2.5 mb-5">
          <span className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
            <MapPin className="w-5 h-5 text-white" />
          </span>
          <div>
            <p className="text-[15px] font-extrabold text-ink leading-none">Canvasser</p>
            <p className="text-[11px] text-muted mt-1">DooGoodScoopers</p>
          </div>
        </div>

        {invite ? (
          <SetPasswordForm token={token!} email={invite.email} />
        ) : (
          <div>
            <p className="text-[14px] font-bold text-ink">This link is invalid or expired</p>
            <p className="text-[12.5px] text-muted mt-1.5">Ask the office to resend your canvasser invite, then tap the new link.</p>
            <Link href="/canvasser/login" className="inline-block mt-4 text-[13px] font-semibold text-iris-link">Go to sign in →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
