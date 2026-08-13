import { bangkokDateStr } from "./date-utils";
import type {
  Submission, Filters, KpiSummary, ChartDatum, AgentRow, PepMetricKey, PepInsightResult,
} from "@/types";

export const ACTIVITY_LIST = [
  "หารายชื่อ",
  "ติดต่อ / เปิดตัว",
  "นัดหมาย",
  "เสนอขาย",
  "Follow Up",
  "ปิดการขาย",
];

export const PEP_META: Record<PepMetricKey, { label: string; focus: string; question: string }> = {
  closingRate: {
    label: "อัตราการปิดการขาย",
    focus: "เทคนิคการปิดการขายและการจัดการข้อโต้แย้งของลูกค้า",
    question: "อะไรคือสิ่งที่ทำให้ลูกค้าลังเลก่อนตัดสินใจปิดการขายบ่อยที่สุด?",
  },
  presentationRate: {
    label: "อัตราการเสนอขาย",
    focus: "การนำเสนอผลิตภัณฑ์ให้น่าสนใจและตรงจุดของลูกค้า",
    question: "หลังการเสนอขายแต่ละครั้ง ลูกค้ามักมีข้อกังวลเรื่องใดมากที่สุด?",
  },
  activityRate: {
    label: "ปริมาณกิจกรรมต่อลูกค้า",
    focus: "วินัยการติดตามลูกค้าและการบริหารจัดการกิจกรรมให้ครบทุกขั้นตอน",
    question: "จะจัดสรรเวลาต่อสัปดาห์อย่างไรให้ครอบคลุมทุกขั้นตอนกิจกรรมกับลูกค้าแต่ละราย?",
  },
  moneyMapRate: {
    label: "อัตราการทำ My Money Map",
    focus: "การใช้ My Money Map เป็นเครื่องมือเปิดบทสนทนาและสร้างความไว้วางใจ",
    question: "จะดึง My Money Map มาใช้ตั้งแต่การพบลูกค้าครั้งแรกได้อย่างไร?",
  },
};

export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}
export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * These three functions power the FilterBar's dropdown options. They must
 * always be called with the FULL, unfiltered submissions list — never
 * `filtered`/`baseFiltered` — so that an agent, contact channel, or lead
 * source never disappears from its dropdown just because the currently
 * selected date range or another filter happens to match zero records for
 * it. (This is what "populate the Agent Name filter from all available
 * submissions before date/channel filtering" means in practice.)
 */
export function getAllAgents(submissions: Submission[]): string[] {
  return uniq(submissions.map((s) => s.agent)).filter(Boolean).sort();
}
export function getAllSources(submissions: Submission[]): string[] {
  return uniq(submissions.map((s) => s.source)).filter(Boolean).sort();
}
export function getAllChannels(submissions: Submission[]): string[] {
  return uniq(submissions.map((s) => s.channel)).filter(Boolean).sort();
}

/** True if a submission's Asia/Bangkok local date satisfies the current date filter. */
export function dateInRange(s: Submission, filters: Filters, todayStr: string): boolean {
  const localDate = bangkokDateStr(s.createdAtUTC);
  if (filters.dateQuick === "today") {
    return localDate === todayStr;
  }
  if (filters.dateQuick === "custom") {
    if (!filters.customStart || !filters.customEnd) return false;
    return localDate >= filters.customStart && localDate <= filters.customEnd;
  }
  return true;
}

/** Date range + contact channel — the shared base every section reacts to before the agent filter. */
export function matchesBase(s: Submission, filters: Filters, todayStr: string): boolean {
  return dateInRange(s, filters, todayStr) && (filters.channelFilter === "all" || s.channel === filters.channelFilter);
}

/** Respects date range + channel + agent — drives KPIs & charts. */
export function getFiltered(submissions: Submission[], filters: Filters, todayStr: string): Submission[] {
  return submissions.filter(
    (s) => matchesBase(s, filters, todayStr) && (filters.agentFilter === "all" || s.agent === filters.agentFilter)
  );
}

/** Respects date range + channel only — drives the agent comparison table & PEP baselines. */
export function getBaseFiltered(submissions: Submission[], filters: Filters, todayStr: string): Submission[] {
  return submissions.filter((s) => matchesBase(s, filters, todayStr));
}

export function computeKpis(filtered: Submission[]): KpiSummary {
  const totalCustomers = uniq(filtered.map((s) => s.customer)).length;
  const totalSubmissions = filtered.length;
  const totalActivities = filtered.reduce((sum, s) => sum + s.activities.length, 0);
  const moneyMapDone = filtered.filter((s) => s.moneyMap === "ทำ").length;
  const presentations = filtered.filter((s) => s.activities.includes("เสนอขาย")).length;
  const closedSales = filtered.filter((s) => s.activities.includes("ปิดการขาย")).length;
  return { totalCustomers, totalSubmissions, totalActivities, moneyMapDone, presentations, closedSales };
}

export function computeClosingData(kpis: KpiSummary, gold: string, bronze: string): ChartDatum[] {
  const closed = kpis.closedSales;
  const notClosed = kpis.totalSubmissions - closed;
  return [
    { name: "ปิดการขาย", value: closed, color: gold },
    { name: "ยังไม่ปิดการขาย", value: notClosed, color: bronze },
  ];
}

export function computeActivityBreakdown(filtered: Submission[]): ChartDatum[] {
  return ACTIVITY_LIST.map((act) => ({
    name: act,
    count: filtered.filter((s) => s.activities.includes(act)).length,
  }));
}

export function computeMoneyMapData(filtered: Submission[], gold: string, bronze: string): ChartDatum[] {
  const done = filtered.filter((s) => s.moneyMap === "ทำ").length;
  const notDone = filtered.length - done;
  return [
    { name: "ทำ My Money Map", value: done, color: gold },
    { name: "ยังไม่ได้ทำ My Money Map", value: notDone, color: bronze },
  ];
}

export function computeChannelData(filtered: Submission[], channels: string[]): ChartDatum[] {
  return channels
    .map((ch) => ({
      name: ch,
      count: filtered.filter((s) => s.channel === ch).reduce((sum, s) => sum + s.activities.length, 0),
    }))
    .filter((d) => d.count > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}

export function computeSourceData(filtered: Submission[], sources: string[]): ChartDatum[] {
  return sources
    .map((src) => ({
      name: src,
      count: filtered.filter((s) => s.source === src).reduce((sum, s) => sum + s.activities.length, 0),
    }))
    .filter((d) => d.count > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}

export function computeAgentTable(baseFiltered: Submission[], agents: string[]): AgentRow[] {
  return agents.map((ag) => {
    const rows = baseFiltered.filter((s) => s.agent === ag);
    const customers = uniq(rows.map((s) => s.customer)).length;
    const activities = rows.reduce((sum, s) => sum + s.activities.length, 0);
    const moneyMap = rows.filter((s) => s.moneyMap === "ทำ").length;
    const presentations = rows.filter((s) => s.activities.includes("เสนอขาย")).length;
    const closed = rows.filter((s) => s.activities.includes("ปิดการขาย")).length;
    return { agent: ag, customers, activities, moneyMap, presentations, closed, closedPct: pct(closed, customers) };
  });
}

export function computePepInsight(
  agentFilter: string,
  baseFiltered: Submission[],
  agents: string[]
): PepInsightResult | null {
  if (agentFilter === "all") return null;
  const rows = baseFiltered.filter((s) => s.agent === agentFilter);
  if (rows.length === 0) return { empty: true };

  const perAgent = agents
    .map((ag) => {
      const r = baseFiltered.filter((s) => s.agent === ag);
      const customers = uniq(r.map((s) => s.customer)).length || 1;
      return {
        agent: ag,
        closingRate: pct(r.filter((s) => s.activities.includes("ปิดการขาย")).length, customers),
        presentationRate: pct(r.filter((s) => s.activities.includes("เสนอขาย")).length, customers),
        activityRate: pct(r.reduce((sum, s) => sum + s.activities.length, 0), customers),
        moneyMapRate: pct(r.filter((s) => s.moneyMap === "ทำ").length, customers),
      };
    })
    .filter((a) => baseFiltered.some((s) => s.agent === a.agent));

  const avg = (key: PepMetricKey) => perAgent.reduce((sum, a) => sum + a[key], 0) / (perAgent.length || 1);
  const averages: Record<PepMetricKey, number> = {
    closingRate: avg("closingRate"),
    presentationRate: avg("presentationRate"),
    activityRate: avg("activityRate"),
    moneyMapRate: avg("moneyMapRate"),
  };

  const customers = uniq(rows.map((s) => s.customer)).length || 1;
  const mine: Record<PepMetricKey, number> = {
    closingRate: pct(rows.filter((s) => s.activities.includes("ปิดการขาย")).length, customers),
    presentationRate: pct(rows.filter((s) => s.activities.includes("เสนอขาย")).length, customers),
    activityRate: pct(rows.reduce((sum, s) => sum + s.activities.length, 0), customers),
    moneyMapRate: pct(rows.filter((s) => s.moneyMap === "ทำ").length, customers),
  };

  const deltas = (Object.keys(mine) as PepMetricKey[]).map((k) => ({ key: k, delta: mine[k] - averages[k] }));
  const strengthKey = deltas.reduce((a, b) => (b.delta > a.delta ? b : a)).key;
  const gapKey = deltas.reduce((a, b) => (b.delta < a.delta ? b : a)).key;

  return { empty: false, strengthKey, gapKey, mine, averages };
}
