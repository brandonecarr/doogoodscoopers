/** Client-safe constants for the call list (no Prisma import — used by client components too). */
export const PROSPECT_TYPES = ["HOA", "APARTMENTS", "SENIOR_55", "OTHER"] as const;
export type ProspectType = (typeof PROSPECT_TYPES)[number];
export const PROSPECT_TYPE_LABEL: Record<ProspectType, string> = { HOA: "HOA", APARTMENTS: "Apartments", SENIOR_55: "55+ community", OTHER: "Other" };
export const PROSPECT_STATUSES = ["TO_CALL", "ATTEMPTED", "CONTACTED", "INTERESTED", "NOT_INTERESTED", "CONVERTED", "ARCHIVED"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];
/** Label + swatch per status, shared by the list, the info page and the status form. */
export const PROSPECT_STATUS_META: Record<ProspectStatus, { label: string; dot: string; badge: string }> = {
  TO_CALL: { label: "To call", dot: "bg-teal-500", badge: "bg-teal-100 text-teal-800" },
  ATTEMPTED: { label: "Attempted / No answer", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-800" },
  CONTACTED: { label: "Contacted", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-800" },
  INTERESTED: { label: "Interested", dot: "bg-purple-500", badge: "bg-purple-100 text-purple-800" },
  NOT_INTERESTED: { label: "Not interested", dot: "bg-gray-500", badge: "bg-gray-100 text-gray-700" },
  CONVERTED: { label: "Converted", dot: "bg-green-500", badge: "bg-green-100 text-green-800" },
  ARCHIVED: { label: "Archived", dot: "bg-gray-400", badge: "bg-gray-100 text-gray-800" },
};
