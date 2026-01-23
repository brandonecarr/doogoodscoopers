import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LeadForm } from "@/components/admin/LeadForm";

export default function NewQuoteLeadPage() {
  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/quote-leads"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Add New Lead</h1>
          <p className="text-navy-600 mt-1">Create a new quote lead manually</p>
        </div>
      </div>

      <LeadForm mode="create" />
    </div>
  );
}
