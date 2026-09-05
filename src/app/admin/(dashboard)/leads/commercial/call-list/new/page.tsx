import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CommercialProspectForm } from "@/components/admin/CommercialProspectForm";

export default function NewProspectPage() {
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <div className="flex items-center gap-4">
        <Link href="/admin/leads/commercial/call-list" className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-gray-600" /></Link>
        <div><h1 className="dgs-title">Add to Call List</h1><p className="text-navy-600 mt-1">A researched HOA, apartment complex or 55+ community you plan to call</p></div>
      </div>
      <CommercialProspectForm />
    </div>
  );
}
