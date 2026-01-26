// Dashboard Types

export interface DashboardSettings {
  widgets: Record<string, boolean>;
  shortcuts: Record<string, boolean>;
  assistance: Record<string, boolean>;
}

export interface StatusCardCounts {
  // Primary Status Cards
  unassignedLocations: number;
  changeRequests: number;
  openOneTimeInvoices: number;
  openRecurringInvoices: number;
  overdueOneTimeInvoices: number;
  overdueRecurringInvoices: number;
  failedOneTimeInvoices: number;
  failedRecurringInvoices: number;
  openJobs: number;

  // Secondary Status Cards
  recurringInvoiceDrafts: number;
  oneTimeInvoiceDrafts: number;
  unoptimizedRoutes: number;
  openShifts: number;
  incompleteShifts: number;
  clockedInStaff: number;
  staffOnBreak: number;
}

export interface MonthlySalesData {
  date: string;
  residential: number;
  commercial: number;
  total: number;
}

export interface MonthlyDataPoint {
  date: string;
  value: number;
}

export interface NewVsLostData {
  date: string;
  new: number;
  lost: number;
  net: number;
}

export interface CancelationReasonData {
  reason: string;
  count: number;
  color: string;
}

export interface ReferralSourceData {
  source: string;
  count: number;
}

export interface ChartData {
  totalSales: MonthlySalesData[];
  activeResClients: MonthlyDataPoint[];
  activeCommClients: MonthlyDataPoint[];
  newVsLostRes: NewVsLostData[];
  newVsLostComm: NewVsLostData[];
  avgResClientValue: MonthlyDataPoint[];
  avgCommClientValue: MonthlyDataPoint[];
  resCancelationReasons: CancelationReasonData[];
  commCancelationReasons: CancelationReasonData[];
  referralSources: ReferralSourceData[];
}

export interface MetricValues {
  // Current month summary values
  totalSalesResidential: number;
  totalSalesCommercial: number;
  totalSalesTotal: number;
  activeResidentialClients: number;
  activeCommercialClients: number;
  newResClients: number;
  lostResClients: number;
  netResClients: number;
  newCommClients: number;
  lostCommClients: number;
  netCommClients: number;
  avgResClientValue: number;
  avgCommClientValue: number;

  // Performance metrics
  avgResClientsPerTech: number;
  avgCommClientsPerTech: number;
  avgResYardsPerHour: number;
  avgCommYardsPerHour: number;
  avgResYardsPerRoute: number;
  avgCommYardsPerRoute: number;
  resChurnRate: number | null;
  commChurnRate: number | null;
  clientLifetimeValue: number | null;
}

export interface DashboardMetrics {
  counts: StatusCardCounts;
  charts: ChartData;
  metrics: MetricValues;
}

export interface DashboardUser {
  id: string;
  orgId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}
