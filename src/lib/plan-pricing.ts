// Estimated monthly revenue per plan, derived from the median of actual charged
// amounts in the historical subscriptions export (Sweep&Go's API doesn't expose
// a per-customer price). Used to estimate MRR on the Customers → Dashboard for
// active customers (whose revenue isn't in the sync feed) and to keep MRR moving
// as customers sign up / cancel going forward.
const CODE_PRICE: Record<string, number> = {
  "1d-1xm": 56, "2d-1xm": 66, "3d-1xm": 76, "4d-1xm": 86,
  "1d-bw": 71, "2d-bw": 81, "3d-bw": 91, "4d-bw": 101,
  "1d-1xw": 89, "2d-1xw": 99, "3d-1xw": 110, "4d-1xw": 121,
  "1d-2xw": 151, "4d-2xw": 206,
};
const SPRAY = 25;
const OVERALL = 89;

/** Best-effort monthly revenue for a customer from their plan code(s) (e.g.
 *  "2d-1xW,Sanitization Spray"). Falls back to the overall median. */
export function estimateMonthlyRevenue(subscriptionNames: string | null | undefined): number {
  const s = (subscriptionNames || "").toLowerCase();
  let total = 0;
  let found = false;
  for (const m of s.matchAll(/(\d+d-\w+)/g)) {
    const price = CODE_PRICE[m[1]];
    if (price != null) { total += price; found = true; }
  }
  if (s.includes("saniti")) { total += SPRAY; found = true; }
  return found ? total : OVERALL;
}
