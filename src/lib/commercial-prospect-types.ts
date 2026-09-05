/** Client-safe constants for the call list (no Prisma import — used by client components too). */
export const PROSPECT_TYPES = ["HOA", "APARTMENTS", "SENIOR_55", "OTHER"] as const;
export type ProspectType = (typeof PROSPECT_TYPES)[number];
export const PROSPECT_TYPE_LABEL: Record<ProspectType, string> = { HOA: "HOA", APARTMENTS: "Apartments", SENIOR_55: "55+ community", OTHER: "Other" };
export const PROSPECT_STATUSES = ["TO_CALL", "ATTEMPTED", "CONVERTED", "ARCHIVED"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];
