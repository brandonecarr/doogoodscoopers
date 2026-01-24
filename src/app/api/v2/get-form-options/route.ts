import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Static form options - these match the format expected by QuoteForm
const staticFormOptions = {
  number_of_dogs: {
    slug: "number_of_dogs",
    value: "1,2,3,4,5",
    type: "select",
  },
  clean_up_frequency: {
    slug: "clean_up_frequency",
    value: "once_a_week,two_times_a_week,bi_weekly,once_a_month,one_time",
    type: "select",
  },
  last_time_yard_was_thoroughly_cleaned: {
    slug: "last_time_yard_was_thoroughly_cleaned",
    value: "one_week,two_weeks,three_weeks,one_month,two_months,3-4_months,5-6_months,10+_months",
    type: "select",
  },
  gate_location: {
    slug: "gate_location",
    value: "left,right,alley,no_gate,other",
    type: "select",
  },
  cleanup_notification_type: {
    slug: "cleanup_notification_type",
    value: "off_schedule,on_the_way,completed",
    type: "checkbox",
  },
  cleanup_notification_chanel: {
    slug: "cleanup_notification_chanel",
    value: "email,sms,call",
    type: "radio",
  },
};

export async function GET() {
  try {
    const supabase = await createClient();

    // Get organization settings for any dynamic configuration
    const { data: org } = await supabase
      .from("organizations")
      .select("id, settings")
      .eq("slug", "doogoodscoopers")
      .single<{ id: string; settings: Record<string, unknown> }>();

    // Build form_fields array in the format expected by QuoteForm
    const formFields = Object.values(staticFormOptions);

    // Get available service plans from database
    if (org) {
      const { data: servicePlans } = await supabase
        .from("service_plans")
        .select("name, frequency")
        .eq("org_id", org.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      // Could enhance form options based on available plans if needed
      // For now, we use static options that match the database values
    }

    return NextResponse.json({
      success: true,
      formOptions: {
        form_fields: formFields,
        organization: {
          name: "DooGoodScoopers",
          slug: "doogoodscoopers",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching form options:", error);

    // Return static fallback even on error
    return NextResponse.json({
      success: true,
      formOptions: {
        form_fields: Object.values(staticFormOptions),
        organization: {
          name: "DooGoodScoopers",
          slug: "doogoodscoopers",
        },
      },
    });
  }
}
