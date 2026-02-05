import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Onboarding settings type definition
interface OnboardingSettings {
  couponCode?: { enabled: boolean };
  maxDogs?: number;
  cleanupFrequencies?: string[];
  lastTimeYardWasCleaned?: { enabled: boolean };
  requestFirstNameBeforeQuote?: { enabled: boolean };
  requestLastNameBeforeQuote?: { enabled: boolean };
  homePhoneNumber?: { enabled: boolean };
  cellPhoneNumber?: { enabled: boolean; required: boolean };
  requestCellPhoneBeforeQuote?: { enabled: boolean };
  requestEmailBeforeQuote?: { enabled: boolean };
  dogNames?: { enabled: boolean; required: boolean };
  isDogSafe?: { enabled: boolean };
  dogBreeds?: { enabled: boolean };
  commentsForEachDog?: { enabled: boolean };
  gateLocation?: { enabled: boolean; required: boolean };
  doggieDoor?: { enabled: boolean; required: boolean };
  garbageCanLocation?: { enabled: boolean };
  gatedCommunity?: { enabled: boolean };
  areasToClean?: { enabled: boolean };
  cleanupNotifications?: { enabled: boolean; required: boolean };
  notificationType?: { enabled: boolean; required: boolean };
  checkPaymentMethod?: { enabled: boolean };
  howHeardAboutUs?: {
    enabled: boolean;
    required: boolean;
    options: string[];
  };
  partialSubmissionNotification?: { enabled: boolean };
  additionalComments?: { enabled: boolean };
}

// Default settings matching SignupFormSetup defaults
const defaultOnboardingSettings: OnboardingSettings = {
  couponCode: { enabled: true },
  maxDogs: 4,
  cleanupFrequencies: ["TWO_TIMES_A_WEEK", "ONCE_A_WEEK", "BI_WEEKLY"],
  lastTimeYardWasCleaned: { enabled: true },
  requestFirstNameBeforeQuote: { enabled: true },
  requestLastNameBeforeQuote: { enabled: false },
  homePhoneNumber: { enabled: false },
  cellPhoneNumber: { enabled: true, required: true },
  requestCellPhoneBeforeQuote: { enabled: false },
  requestEmailBeforeQuote: { enabled: false },
  dogNames: { enabled: true, required: true },
  isDogSafe: { enabled: true },
  dogBreeds: { enabled: false },
  commentsForEachDog: { enabled: false },
  gateLocation: { enabled: true, required: true },
  doggieDoor: { enabled: true, required: true },
  garbageCanLocation: { enabled: false },
  gatedCommunity: { enabled: false },
  areasToClean: { enabled: false },
  cleanupNotifications: { enabled: true, required: true },
  notificationType: { enabled: true, required: true },
  checkPaymentMethod: { enabled: false },
  howHeardAboutUs: {
    enabled: true,
    required: true,
    options: [
      "SEARCH_ENGINE",
      "PREVIOUS_CLIENT",
      "REFERRED_BY_FAMILY_OR_FRIEND",
      "FLIER_FROM_BUSINESS",
      "SOCIAL_MEDIA",
      "VEHICLE_SIGNAGE",
      "YARD_SIGN",
      "SALES_REPRESENTATIVE",
      "OTHER",
    ],
  },
  partialSubmissionNotification: { enabled: true },
  additionalComments: { enabled: true },
};

// Map frequency setting values to form option values
const frequencyMap: Record<string, string> = {
  SEVEN_TIMES_A_WEEK: "seven_times_a_week",
  SIX_TIMES_A_WEEK: "six_times_a_week",
  FIVE_TIMES_A_WEEK: "five_times_a_week",
  FOUR_TIMES_A_WEEK: "four_times_a_week",
  THREE_TIMES_A_WEEK: "three_times_a_week",
  TWO_TIMES_A_WEEK: "two_times_a_week",
  ONCE_A_WEEK: "once_a_week",
  BI_WEEKLY: "bi_weekly",
  TWICE_PER_MONTH: "twice_per_month",
  EVERY_THREE_WEEKS: "every_three_weeks",
  EVERY_FOUR_WEEKS: "every_four_weeks",
  ONCE_A_MONTH: "once_a_month",
  ONE_TIME: "one_time",
};

// Build form options based on onboarding settings
function buildFormOptions(settings: OnboardingSettings) {
  // Build number_of_dogs options based on maxDogs setting
  const maxDogs = settings.maxDogs || 5;
  const dogOptions = Array.from({ length: maxDogs }, (_, i) => String(i + 1)).join(",");

  // Build frequency options based on cleanupFrequencies setting
  const enabledFrequencies = settings.cleanupFrequencies || ["ONCE_A_WEEK", "BI_WEEKLY"];
  const frequencyValues = enabledFrequencies
    .map((f) => frequencyMap[f] || f.toLowerCase())
    .join(",");

  return {
    number_of_dogs: {
      slug: "number_of_dogs",
      value: dogOptions,
      type: "select",
    },
    clean_up_frequency: {
      slug: "clean_up_frequency",
      value: frequencyValues,
      type: "select",
    },
    last_time_yard_was_thoroughly_cleaned: {
      slug: "last_time_yard_was_thoroughly_cleaned",
      value: "one_week,two_weeks,three_weeks,one_month,two_months,3-4_months,5-6_months,10+_months",
      type: "select",
      enabled: settings.lastTimeYardWasCleaned?.enabled ?? true,
    },
    gate_location: {
      slug: "gate_location",
      value: "left,right,alley,no_gate,other",
      type: "select",
      enabled: settings.gateLocation?.enabled ?? true,
      required: settings.gateLocation?.required ?? true,
    },
    cleanup_notification_type: {
      slug: "cleanup_notification_type",
      value: "off_schedule,on_the_way,completed",
      type: "checkbox",
      enabled: settings.cleanupNotifications?.enabled ?? true,
      required: settings.cleanupNotifications?.required ?? true,
    },
    cleanup_notification_chanel: {
      slug: "cleanup_notification_chanel",
      value: "email,sms,call",
      type: "radio",
      enabled: settings.notificationType?.enabled ?? true,
      required: settings.notificationType?.required ?? true,
    },
    how_heard_about_us: {
      slug: "how_heard_about_us",
      value: (settings.howHeardAboutUs?.options || []).join(","),
      type: "select",
      enabled: settings.howHeardAboutUs?.enabled ?? true,
      required: settings.howHeardAboutUs?.required ?? true,
    },
  };
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Get organization settings for dynamic configuration
    const { data: org } = await supabase
      .from("organizations")
      .select("id, settings")
      .eq("slug", "doogoodscoopers")
      .single<{ id: string; settings: Record<string, unknown> | null }>();

    // Get default coupon if one exists
    let defaultCoupon: {
      code: string;
      discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_VISITS";
      discountValue: number;
    } | null = null;
    if (org?.id) {
      const { data: couponData } = await supabase
        .from("coupons")
        .select("code, discount_type, discount_value")
        .eq("org_id", org.id)
        .eq("is_default", true)
        .eq("is_active", true)
        .single<{ code: string; discount_type: string; discount_value: number }>();

      if (couponData?.code) {
        defaultCoupon = {
          code: couponData.code,
          discountType: couponData.discount_type as "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_VISITS",
          discountValue: couponData.discount_value,
        };
      }
    }

    // Extract onboarding settings from organization settings
    const orgSettings = (org?.settings || {}) as {
      onboarding?: OnboardingSettings;
      calloutDisclaimers?: {
        calloutText?: string;
        pricingDisclaimers?: string;
        advertisingDisclaimers?: { id: string; text: string }[];
        specialPromo?: {
          title: string;
          description: string;
          autoPreselected: boolean;
        };
      };
    };
    const onboardingSettings: OnboardingSettings = {
      ...defaultOnboardingSettings,
      ...(orgSettings.onboarding || {}),
    };

    // Extract callout/disclaimers settings
    const calloutDisclaimers = orgSettings.calloutDisclaimers || {
      calloutText: "",
      pricingDisclaimers: "",
      advertisingDisclaimers: [],
      specialPromo: { title: "", description: "", autoPreselected: false },
    };

    // Build form fields based on onboarding settings
    const formFieldsObject = buildFormOptions(onboardingSettings);
    const formFields = Object.values(formFieldsObject);

    return NextResponse.json({
      success: true,
      formOptions: {
        form_fields: formFields,
        organization: {
          name: "DooGoodScoopers",
          slug: "doogoodscoopers",
        },
      },
      // Include onboarding settings for frontend conditional rendering
      onboardingSettings: {
        couponCode: onboardingSettings.couponCode,
        defaultCoupon,
        maxDogs: onboardingSettings.maxDogs,
        lastTimeYardWasCleaned: onboardingSettings.lastTimeYardWasCleaned,
        requestFirstNameBeforeQuote: onboardingSettings.requestFirstNameBeforeQuote,
        requestLastNameBeforeQuote: onboardingSettings.requestLastNameBeforeQuote,
        homePhoneNumber: onboardingSettings.homePhoneNumber,
        cellPhoneNumber: onboardingSettings.cellPhoneNumber,
        requestCellPhoneBeforeQuote: onboardingSettings.requestCellPhoneBeforeQuote,
        requestEmailBeforeQuote: onboardingSettings.requestEmailBeforeQuote,
        dogNames: onboardingSettings.dogNames,
        isDogSafe: onboardingSettings.isDogSafe,
        dogBreeds: onboardingSettings.dogBreeds,
        commentsForEachDog: onboardingSettings.commentsForEachDog,
        gateLocation: onboardingSettings.gateLocation,
        doggieDoor: onboardingSettings.doggieDoor,
        garbageCanLocation: onboardingSettings.garbageCanLocation,
        gatedCommunity: onboardingSettings.gatedCommunity,
        areasToClean: onboardingSettings.areasToClean,
        cleanupNotifications: onboardingSettings.cleanupNotifications,
        notificationType: onboardingSettings.notificationType,
        checkPaymentMethod: onboardingSettings.checkPaymentMethod,
        howHeardAboutUs: onboardingSettings.howHeardAboutUs,
        additionalComments: onboardingSettings.additionalComments,
      },
      // Include callout/disclaimers settings for frontend display
      calloutDisclaimers,
    });
  } catch (error) {
    console.error("Error fetching form options:", error);

    // Return default options on error
    const formFieldsObject = buildFormOptions(defaultOnboardingSettings);
    return NextResponse.json({
      success: true,
      formOptions: {
        form_fields: Object.values(formFieldsObject),
        organization: {
          name: "DooGoodScoopers",
          slug: "doogoodscoopers",
        },
      },
      onboardingSettings: defaultOnboardingSettings,
      calloutDisclaimers: {
        calloutText: "",
        pricingDisclaimers: "",
        advertisingDisclaimers: [],
        specialPromo: { title: "", description: "", autoPreselected: false },
      },
    });
  }
}
