import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { CommercialProspectForm } from "@/components/admin/CommercialProspectForm";

export default async function EditProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.commercialProspect.findUnique({ where: { id } });
  if (!p) notFound();
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center gap-4">
        <Link href="/admin/leads/commercial/call-list" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></Link>
        <div><h1 className="dgs-title">Edit Prospect</h1><p className="text-navy-600 mt-1">{p.propertyName}</p></div>
      </div>
      <CommercialProspectForm mode="edit" prospect={{ id: p.id, propertyName: p.propertyName, propertyType: p.propertyType, contactName: p.contactName, phone: p.phone, email: p.email, city: p.city, state: p.state, zipCode: p.zipCode, address: p.address, units: p.units, notes: p.notes, source: p.source }} />
    </div>
  );
}
