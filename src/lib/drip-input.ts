import { LINK_PLACEHOLDER } from "@/lib/campaign-templates";

// Shared validation for the drip builder's create and edit requests.

export interface DripInput {
  leadTypes?: string[];
  steps?: Array<{ body?: string; delayMinutes?: number; channel?: string; subject?: string }>;
  excludeIds?: unknown;
  includeNew?: unknown;
  emailFromName?: unknown;
}

export function parseDripInput(b: DripInput, opts: { draft: boolean }) {
  const steps = (b.steps || [])
    .filter((s) => s.body?.trim())
    .map((s, i) => {
      const channel = s.channel === "email" ? "email" : "sms";
      return {
        stepOrder: i,
        body: s.body!.trim(),
        delayMinutes: Math.max(0, Math.round(s.delayMinutes || 0)),
        channel,
        subject: channel === "email" ? (s.subject || "").trim() || null : null,
      };
    });
  const leadTypes = b.leadTypes || [];
  const former = leadTypes.includes("former_customers");
  const audienceFilter = {
    leadTypes,
    ...(former
      ? {
          excludeIds: Array.isArray(b.excludeIds) ? b.excludeIds.filter((x): x is string => typeof x === "string") : [],
          includeNew: b.includeNew === true,
        }
      : {}),
  };
  const emailFromName = typeof b.emailFromName === "string" && b.emailFromName.trim() ? b.emailFromName.trim() : null;

  let error: string | null = null;
  if (!opts.draft) {
    if (!leadTypes.length) error = "Pick at least one trigger lead type";
    else if (former && leadTypes.length > 1) error = "Former customers can't be combined with other audiences";
    else if (steps.length === 0) error = "Add at least one message";
    else error = stepsProblem(steps);
  }
  return { steps, audienceFilter, emailFromName, error };
}

/** Why a sequence isn't ready to send, or null. */
export function stepsProblem(steps: Array<{ body: string; channel: string; subject: string | null }>): string | null {
  const i = steps.findIndex((s) => s.channel === "email" && !s.subject);
  if (i >= 0) return `Message ${i + 1} is an email and needs a subject`;
  const j = steps.findIndex((s) => s.body.includes(LINK_PLACEHOLDER));
  if (j >= 0) return `Message ${j + 1} still has the placeholder signup link. Replace it with your real link.`;
  return null;
}
