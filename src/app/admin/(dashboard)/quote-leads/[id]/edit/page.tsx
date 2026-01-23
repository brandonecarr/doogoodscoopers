import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { LeadForm } from "@/components/admin/LeadForm";
import type { QuoteLead } from "@/types/leads";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getQuoteLead(id: string) {
  const lead = await prisma.quoteLead.findUnique({
    where: { id },
  });

  return lead;
}

export default async function EditQuoteLeadPage({ params }: PageProps) {
  const { id } = await params;
  const lead = await getQuoteLead(id);

  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/quote-leads/${id}`}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Edit Lead</h1>
          <p className="text-navy-600 mt-1">
            {lead.firstName} {lead.lastName || ""}
          </p>
        </div>
      </div>

      <LeadForm lead={lead as QuoteLead} mode="edit" />
    </div>
  );
}
