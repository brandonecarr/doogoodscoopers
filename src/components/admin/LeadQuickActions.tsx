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

/** Build the prefilled Sweep&Go onboarding URL (only non-empty fields). */
export function onboardingUrl({ firstName, lastName, email, zipCode, numberOfDogs, phone }: Props): string {
  const p = new URLSearchParams();
  if (zipCode) p.set("zip_code", zipCode);
  if (firstName) p.set("first_name", firstName);
  if (lastName) p.set("last_name", lastName);
  if (email) p.set("your_email_address", email);
  if (numberOfDogs) {
    const n = String(numberOfDogs).match(/\d+/)?.[0];
    if (n) p.set("number_of_dogs", n);
  }
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits) p.set("cell_phone_number", digits);
  }
  const qs = p.toString();
  return qs ? `${ONBOARDING_BASE}?${qs}` : ONBOARDING_BASE;
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
