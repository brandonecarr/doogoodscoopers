/**
 * Public Settings Utilities
 *
 * Fetches organization settings for public-facing pages (no auth required).
 * Since this is currently single-tenant, fetches from the first/default organization.
 */

import { createClient } from "@supabase/supabase-js";

// Create a Supabase client with service role for server-side fetching
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase environment variables not configured");
  }
  return createClient(url, serviceKey);
}

export interface DocumentSection {
  id: string;
  icon: string;
  title: string;
  content: string;
}

export interface LegalDocumentSettings {
  sections: DocumentSection[];
  lastUpdated: string | null;
}

/**
 * Fetch legal document settings (Terms of Service or Privacy Policy)
 * Returns the saved settings or null if none exist
 */
export async function getLegalDocumentSettings(
  documentType: "termsOfService" | "privacyPolicy"
): Promise<LegalDocumentSettings | null> {
  try {
    const supabase = getSupabase();

    // Fetch the first organization's settings (single-tenant)
    const { data: org, error } = await supabase
      .from("organizations")
      .select("settings")
      .limit(1)
      .single();

    if (error || !org) {
      console.error("Error fetching organization settings:", error);
      return null;
    }

    const settings = org.settings as Record<string, unknown> | null;
    const docSettings = settings?.[documentType] as LegalDocumentSettings | undefined;

    if (!docSettings || !docSettings.sections || docSettings.sections.length === 0) {
      return null;
    }

    return docSettings;
  } catch (error) {
    console.error("Error fetching legal document settings:", error);
    return null;
  }
}
