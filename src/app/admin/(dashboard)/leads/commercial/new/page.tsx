import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CommercialLeadForm } from "@/components/admin/CommercialLeadForm";

export default function NewCommercialLeadPage() {
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/leads/commercial" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="dgs-title">Add New Commercial Lead</h1>
          <p className="text-navy-600 mt-1">Create a new commercial lead manually</p>
        </div>
      </div>

      <CommercialLeadForm />
    </div>
  );
}
