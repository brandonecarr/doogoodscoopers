import Link from "next/link";
import { redirect } from "next/navigation";
import { getCanvasserSession } from "@/lib/canvasser-auth";
import prisma from "@/lib/prisma";
import { MapPin, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", NO_ANSWER: "No answer",
  NOT_INTERESTED: "Not interested", WAITING_FOR_SIGNUP: "Waiting", CONVERTED: "Signed up", PHONE_REVIEW: "Review",
};

export default async function MyLeadsPage() {
  const session = await getCanvasserSession();
  if (!session) redirect("/canvasser/login");
  const leads = await prisma.canvasserLead.findMany({
    where: { canvasserId: session.id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <div className="space-y-2.5">
      <h1 className="text-[16px] font-extrabold text-gray-900 px-1">My Leads <span className="text-gray-400 font-semibold">({leads.length})</span></h1>

      {leads.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
          <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-[13.5px] text-gray-500">No leads yet. Mark a home as a lead from the map and it&apos;ll show up here.</p>
        </div>
      ) : (
        leads.map((l) => {
          const name = [l.firstName, l.lastName].filter(Boolean).join(" ") || "Unnamed";
          return (
            <Link key={l.id} href={`/app/canvasser/lead/${l.id}`} className="block bg-white rounded-2xl p-3.5 border border-gray-100 active:bg-gray-50">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-bold text-gray-900">{name}</p>
                <span className="inline-flex items-center gap-1">
                  <span className="text-[10.5px] font-semibold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">{STATUS_LABEL[l.status] ?? l.status}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </span>
              </div>
              {(l.address || l.city || l.zipCode) && (
                <p className="text-[12.5px] text-gray-600 mt-0.5">{[l.address, l.city, l.zipCode].filter(Boolean).join(", ")}</p>
              )}
              {l.phone && <p className="text-[12.5px] text-gray-500 mt-0.5">{l.phone}</p>}
              {l.notes && <p className="text-[12px] text-gray-500 mt-1.5 italic line-clamp-2">{l.notes}</p>}
            </Link>
          );
        })
      )}
    </div>
  );
}
