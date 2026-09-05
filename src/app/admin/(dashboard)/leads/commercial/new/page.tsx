import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CommercialLeadForm } from "@/components/admin/CommercialLeadForm";

export default function NewCommercialLeadPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/leads/commercial" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Commercial leads
        </Link>
        <h1 className="text-2xl font-bold text-navy-900 mt-2">New commercial lead</h1>
        <p className="text-sm text-gray-500 mt-1">An HOA, apartment complex, property manager or business you spoke to by phone, in person, or by email.</p>
      </div>
      <CommercialLeadForm />
    </div>
  );
}
