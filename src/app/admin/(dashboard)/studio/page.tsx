import { Sparkles } from "lucide-react";
import { StudioApp } from "@/components/admin/studio/StudioApp";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="dgs-title flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#008EEF] to-[#00A6D6] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </span>
          Content Studio
        </h1>
        <p className="text-navy-600 text-sm mt-1">
          Design on-brand Instagram carousels — pick a template, edit the text, and download the images. Everything renders right here in your browser.
        </p>
      </div>
      <StudioApp />
    </div>
  );
}
