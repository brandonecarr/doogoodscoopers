import { Phone, Mail, ClipboardList } from "lucide-react";

// Sweep&Go onboarding base — the quote-skipper prefills it so leads land on the
// signup step, not the quote (we've already quoted them by this point).
const ONBOARDING_BASE = "https://doogoodscoopers.com/sng/doogoodscoopers-obc2w-client-onboarding";

interface Props {
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  zipCode?: string | null;
  numberOfDogs?: string | null;
}

/** Format a phone the way the generator does: `(909) 434-4706` from 10 digits. */
function formatCellPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1); // drop US country code
  d = d.slice(0, 10);
  if (d.length < 3) return d || undefined;
  if (d.length < 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Build the prefilled Sweep&Go onboarding URL.
 *
 * Mirrors the quote-skipper generator (sweepandgo.com/quote-gen/generator.html)
 * exactly: parameters are appended in the form's order (the onboarding page
 * reads them positionally, so order matters), each value is encodeURIComponent'd
 * (space → %20, parens stay literal), the phone is formatted `(909) 434-4706`,
 * and empty fields are skipped.
 */
export function onboardingUrl({ firstName, lastName, email, zipCode, numberOfDogs, phone }: Props): string {
  const params: string[] = [];
  const add = (key: string, val?: string | null) => {
    if (val != null && val !== "") params.push(`${key}=${encodeURIComponent(val)}`);
  };

  add("zip_code", zipCode?.trim());
  add("number_of_dogs", numberOfDogs ? String(numberOfDogs).match(/\d+/)?.[0] : undefined);
  // Always default to weekly service — the form's slider uses the snake_case
  // value (verified live); the human "Once a week" is ignored.
  add("clean_up_frequency", "once_a_week");
  add("first_name", firstName?.trim());
  add("last_name", lastName?.trim());
  add("your_email_address", email?.trim());
  add("cell_phone_number", formatCellPhone(phone));
  // The lead came through our marketing, so mark marketing as allowed.
  add("marketing_allowed", "true");

  return params.length ? `${ONBOARDING_BASE}?${params.join("&")}` : ONBOARDING_BASE;
}

export function LeadQuickActions(props: Props) {
  const { phone, email } = props;
  const onboarding = onboardingUrl(props);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Quick Actions</h2>
      <div className="space-y-3">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Phone className="w-4 h-4" />
            Call Lead
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-navy-900 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Send Email
          </a>
        )}
        {phone && (
          <a
            href={`sms:${phone}&body=${encodeURIComponent(onboarding)}`}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-navy-600 text-white rounded-lg hover:bg-navy-700 transition-colors"
          >
            <ClipboardList className="w-4 h-4" />
            Send Onboarding
          </a>
        )}
      </div>
    </div>
  );
}
