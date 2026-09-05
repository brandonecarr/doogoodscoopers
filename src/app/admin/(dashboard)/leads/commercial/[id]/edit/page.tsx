import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { CommercialLeadForm } from "@/components/admin/CommercialLeadForm";
import type { LeadStatus } from "@/types/leads";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCommercialLeadPage({ params }: PageProps) {
  const { id } = await params;
  const lead = await prisma.commercialLead.findUnique({ where: { id } });
  if (!lead) notFound();

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/leads/commercial/${id}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="dgs-title">Edit Commercial Lead</h1>
          <p className="text-navy-600 mt-1">{lead.propertyName}</p>
        </div>
      </div>

      <CommercialLeadForm
        mode="edit"
        lead={{
          id: lead.id, contactName: lead.contactName, propertyName: lead.propertyName, phone: lead.phone, email: lead.email,
          city: lead.city, state: lead.state, zipCode: lead.zipCode, status: lead.status as LeadStatus, inquiry: lead.inquiry,
        }}
      />
    </div>
  );
}
