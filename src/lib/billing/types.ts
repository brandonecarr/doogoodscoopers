/**
 * Types for the Billing module
 */

export type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'OVERDUE' | 'VOID' | 'FAILED';
export type BillingOption = 'PREPAID_FIXED' | 'PREPAID_VARIABLE' | 'POSTPAID';
export type BillingInterval = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type PaymentMethod = 'CREDIT_CARD' | 'CHECK' | 'CASH' | 'ACH' | 'OTHER';
export type ClientType = 'RESIDENTIAL' | 'COMMERCIAL';

export interface RecurringInvoiceClient {
  id: string;
  name: string;
  type: ClientType;
  address: string;
  email: string | null;
}

export interface RecurringInvoiceSubscription {
  id: string;
  planName: string | null;
  frequency: string;
}

export interface RecurringInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface RecurringInvoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  createdAt: string;
  client: RecurringInvoiceClient;
  paymentMethod: PaymentMethod | null;
  billingOption: BillingOption;
  billingInterval: BillingInterval;
  totalCents: number;
  tipCents: number;
  remainingCents: number;
  paidCents: number;
  subscription: RecurringInvoiceSubscription;
  items: RecurringInvoiceItem[];
}

export interface RecurringInvoiceStats {
  draft: { count: number; amountCents: number };
  open: { count: number; amountCents: number };
  overdue: { count: number; amountCents: number };
  paid: { count: number; amountCents: number };
  failed: { count: number; amountCents: number };
  totalAmountCents: number;
  totalTipsCents: number;
}

export interface RecurringInvoiceFilters {
  search?: string;
  status?: string[];
  startDate?: string;
  endDate?: string;
  billingOption?: BillingOption;
  paymentMethod?: PaymentMethod;
  clientType?: ClientType;
  showZeroInvoices?: boolean;
  withTips?: boolean;
}

export interface RecurringInvoicesResponse {
  invoices: RecurringInvoice[];
  stats: RecurringInvoiceStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Display labels for billing options
export const BILLING_OPTION_LABELS: Record<BillingOption, string> = {
  PREPAID_FIXED: 'Prepaid Fixed',
  PREPAID_VARIABLE: 'Prepaid Variable',
  POSTPAID: 'Postpaid',
};

// Display labels for billing intervals
export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Bi-weekly',
  MONTHLY: 'Monthly',
};

// Display labels for payment methods
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CREDIT_CARD: 'Credit Card',
  CHECK: 'Check',
  CASH: 'Cash',
  ACH: 'ACH',
  OTHER: 'Other',
};

// Status colors for UI display
export const STATUS_COLORS: Record<InvoiceStatus, { text: string; bg: string }> = {
  DRAFT: { text: 'text-gray-700', bg: 'bg-gray-100' },
  OPEN: { text: 'text-blue-700', bg: 'bg-blue-100' },
  PAID: { text: 'text-green-700', bg: 'bg-green-100' },
  OVERDUE: { text: 'text-red-700', bg: 'bg-red-100' },
  VOID: { text: 'text-gray-500', bg: 'bg-gray-100' },
  FAILED: { text: 'text-red-700', bg: 'bg-red-100' },
};

// Status display labels
export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Voided',
  FAILED: 'Failed',
};
