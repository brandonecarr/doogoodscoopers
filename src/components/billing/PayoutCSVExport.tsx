/**
 * Payout CSV Export Utilities
 *
 * Functions for generating and downloading CSV files for Stripe payouts.
 */

export interface PayoutForCSV {
  id: string;
  status: string;
  created: string;
  arrivalDate: string;
  netCents: number;
}

export interface TransactionForCSV {
  amountCents: number;
  feeCents: number;
  netCents: number;
  tipCents: number;
  customerName: string | null;
  customerEmail: string | null;
  invoiceNumber: string | null;
}

/**
 * Escape a value for CSV format
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format a date string for CSV
 */
export function formatDateForCSV(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Format cents as dollars string for CSV
 */
export function formatCentsForCSV(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Generate CSV content for a single payout with its transactions
 */
export function generatePayoutCSV(
  payout: PayoutForCSV,
  transactions: TransactionForCSV[]
): string {
  const headers = [
    "Payout ID",
    "Status",
    "Date Created",
    "Arrival Date",
    "Payout Amount",
    "Amount",
    "Fee",
    "Net",
    "Tip",
    "Customer Full Name",
    "Customer Email",
    "Invoice No.",
  ];

  const rows = transactions.map((txn) => [
    escapeCSV(payout.id),
    escapeCSV(payout.status),
    escapeCSV(formatDateForCSV(payout.created)),
    escapeCSV(formatDateForCSV(payout.arrivalDate)),
    escapeCSV(formatCentsForCSV(payout.netCents)),
    escapeCSV(formatCentsForCSV(txn.amountCents)),
    escapeCSV(formatCentsForCSV(txn.feeCents)),
    escapeCSV(formatCentsForCSV(txn.netCents)),
    escapeCSV(formatCentsForCSV(txn.tipCents)),
    escapeCSV(txn.customerName),
    escapeCSV(txn.customerEmail),
    escapeCSV(txn.invoiceNumber),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Generate CSV content for multiple payouts with their transactions
 * Used for bulk export from the payouts list
 */
export function generateMultiplePayoutsCSV(
  payoutsWithTransactions: Array<{
    payout: PayoutForCSV;
    transactions: TransactionForCSV[];
  }>
): string {
  const headers = [
    "Payout ID",
    "Status",
    "Date Created",
    "Arrival Date",
    "Payout Amount",
    "Amount",
    "Fee",
    "Net",
    "Tip",
    "Customer Full Name",
    "Customer Email",
    "Invoice No.",
  ];

  const allRows: string[][] = [];

  for (const { payout, transactions } of payoutsWithTransactions) {
    for (const txn of transactions) {
      allRows.push([
        escapeCSV(payout.id),
        escapeCSV(payout.status),
        escapeCSV(formatDateForCSV(payout.created)),
        escapeCSV(formatDateForCSV(payout.arrivalDate)),
        escapeCSV(formatCentsForCSV(payout.netCents)),
        escapeCSV(formatCentsForCSV(txn.amountCents)),
        escapeCSV(formatCentsForCSV(txn.feeCents)),
        escapeCSV(formatCentsForCSV(txn.netCents)),
        escapeCSV(formatCentsForCSV(txn.tipCents)),
        escapeCSV(txn.customerName),
        escapeCSV(txn.customerEmail),
        escapeCSV(txn.invoiceNumber),
      ]);
    }
  }

  return [headers.join(","), ...allRows.map((r) => r.join(","))].join("\n");
}

/**
 * Download CSV content as a file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
