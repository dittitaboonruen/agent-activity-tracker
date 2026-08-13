// A single normalized Jotform submission for the Agent Activity Tracker form.
export interface Submission {
  id: string;
  customer: string;
  source: string;
  channel: string;
  moneyMap: string; // "ทำ" | "ยังไม่ได้ทำ" (or whatever the form's radio option text is)
  agent: string;
  activities: string[]; // one or more of ACTIVITY_LIST
  createdAtUTC: string; // ISO 8601 UTC timestamp, as returned by the server API route
}

export type DateQuickOption = "today" | "custom";

export interface Filters {
  dateQuick: DateQuickOption;
  customStart: string; // YYYY-MM-DD, Asia/Bangkok calendar date
  customEnd: string; // YYYY-MM-DD, Asia/Bangkok calendar date
  agentFilter: string; // "all" or an agent name/code
  channelFilter: string; // "all" or a contact channel
}

export interface JotformApiResponse {
  submissions: Submission[];
  fetchedAtUTC: string;
}

export interface JotformApiError {
  error: string;
}

export interface KpiSummary {
  totalCustomers: number;
  totalSubmissions: number;
  totalActivities: number;
  moneyMapDone: number;
  presentations: number;
  closedSales: number;
}

export interface ChartDatum {
  name: string;
  value?: number;
  count?: number;
  color?: string;
}

export interface AgentRow {
  agent: string;
  customers: number;
  activities: number;
  moneyMap: number;
  presentations: number;
  closed: number;
  closedPct: number;
}

export type PepMetricKey = "closingRate" | "presentationRate" | "activityRate" | "moneyMapRate";

export interface PepInsightResult {
  empty: boolean;
  strengthKey?: PepMetricKey;
  gapKey?: PepMetricKey;
  mine?: Record<PepMetricKey, number>;
  averages?: Record<PepMetricKey, number>;
}
