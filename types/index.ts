// A single normalized Jotform submission
// for the Agent Activity Tracker form.
export interface Submission {
  id: string;

  customer: string;

  source: string;

  channel: string;

  moneyMap: string;
  // "ทำ" | "ยังไม่ได้ทำ"
  // หรือข้อความ option จริงจาก Jotform

  agent: string;

  activities: string[];
  // one or more of ACTIVITY_LIST

  createdAtUTC: string;
  // ISO 8601 UTC timestamp
  // as returned by the server API route
}

/* =========================================================
   FILTERS
========================================================= */

export type DateQuickOption =
  | "today"
  | "custom";

export interface Filters {
  dateQuick: DateQuickOption;

  customStart: string;
  // YYYY-MM-DD
  // Asia/Bangkok calendar date

  customEnd: string;
  // YYYY-MM-DD
  // Asia/Bangkok calendar date

  agentFilter: string;
  // "all" or an agent name/code

  channelFilter: string;
  // "all" or a contact channel
}

/* =========================================================
   JOTFORM API
========================================================= */

export interface JotformApiResponse {
  submissions: Submission[];

  fetchedAtUTC: string;
}

export interface JotformApiError {
  error: string;
}

/* =========================================================
   KPI SUMMARY
========================================================= */

export interface KpiSummary {
  totalCustomers: number;

  totalSubmissions: number;

  totalActivities: number;

  moneyMapDone: number;

  presentations: number;

  closedSales: number;
}

/* =========================================================
   CHART DATA
========================================================= */

export interface ChartDatum {
  name: string;

  value?: number;

  count?: number;

  color?: string;
}

/* =========================================================
   AGENT PERFORMANCE TABLE

   Sales Process Standard:
   9 Steps → 3 Main Groups

   1. Prospecting = หารายชื่อ
   2. Sales = ขาย
   3. Service = บริการ
========================================================= */

export interface AgentRow {
  agent: string;

  customers: number;

  // 3 Main Sales Process Groups
  prospecting: number;

  sales: number;

  service: number;

  // Total number of activities
  activities: number;

  moneyMap: number;

  presentations: number;

  closed: number;

  closedPct: number;
}

/* =========================================================
   PEP INSIGHT
========================================================= */

export type PepMetricKey =
  | "closingRate"
  | "presentationRate"
  | "activityRate"
  | "moneyMapRate";

export interface PepInsightResult {
  empty: boolean;

  strengthKey?: PepMetricKey;

  gapKey?: PepMetricKey;

  mine?: Record<
    PepMetricKey,
    number
  >;

  averages?: Record<
    PepMetricKey,
    number
  >;
}

/* =========================================================
   PEP NOTES
========================================================= */

/**
 * A manager-authored PEP note,
 * stored in Supabase table:
 * public.pep_notes
 *
 * Entirely separate from Jotform-derived data.
 *
 * Each save creates a new history row.
 * This is an append-only log,
 * not an edit-in-place record.
 */
export interface PepNote {
  id: number;

  agentName: string;

  pepDate: string;
  // YYYY-MM-DD
  // date the PEP session covers

  recommendation: string;

  coachingQuestion: string;

  actionPlan: string;

  createdAt: string;
  // ISO timestamp

  updatedAt: string;
  // ISO timestamp
}

/**
 * Payload for creating
 * a new PEP note via:
 *
 * POST /api/pep-notes
 */
export interface PepNoteInput {
  agentName: string;

  pepDate: string;

  recommendation: string;

  coachingQuestion: string;

  actionPlan: string;
}
