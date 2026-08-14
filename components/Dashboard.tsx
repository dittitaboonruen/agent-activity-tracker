"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Filters, Submission, JotformApiResponse } from "@/types";
import { todayBangkokStr, bangkokRefreshLabel } from "@/lib/date-utils";
import { sanitizeFilterChange } from "@/lib/validation";
import {
  getAllAgents,
  getAllSources,
  getAllChannels,
  getFiltered,
  getBaseFiltered,
  computeKpis,
  computeClosingData,
  computeActivityBreakdown,
  computeMoneyMapData,
  computeChannelData,
  computeSourceData,
  computeAgentTable,
  computePepInsight,
  PEP_META,
} from "@/lib/dashboard-calculations";

import { SectionLabel, KpiCard } from "./ui";
import FilterBar from "./FilterBar";
import ActivitySummary from "./ActivitySummary";
import ClosingStatusCard from "./ClosingStatusCard";
import ActivityBreakdownCard from "./ActivityBreakdownCard";
import MoneyMapCard from "./MoneyMapCard";
import ChannelCard from "./ChannelCard";
import SourceCard from "./SourceCard";
import AgentTable from "./AgentTable";
import PepInsightCard from "./PepInsightCard";
import PepNotesPanel from "./PepNotesPanel";

const GOLD = "#C9A24B";
const BRONZE = "#4A3B1E";
const FORM_TITLE = "Agent Activity Tracker";

const DEFAULT_FILTERS: Filters = {
  dateQuick: "today",
  customStart: "",
  customEnd: "",
  agentFilter: "all",
  channelFilter: "all",
};

interface DashboardProps {
  /**
   * Server-prefetched submissions (see app/page.tsx), read through the same
   * short cache as /api/jotform. When present, the dashboard renders fully
   * populated on first paint — no blocking loading state — and then silently
   * revalidates in the background. When null (prefetch failed or the cache
   * was cold with no prior server data), the dashboard falls back to its own
   * client-side fetch + blocking loading UI, same as before this change.
   */
  initialData?: JotformApiResponse | null;
}

export default function Dashboard({ initialData = null }: DashboardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>(initialData?.submissions ?? []);
  const [lastFetchedUTC, setLastFetchedUTC] = useState<string | null>(initialData?.fetchedAtUTC ?? null);
  // `loading` blocks the dashboard (shows the loading banner, no data underneath) —
  // true only when there is truly nothing to show yet.
  const [loading, setLoading] = useState(!initialData);
  // `refreshing` is the non-blocking stale-while-revalidate indicator: a fetch is
  // in flight, but the dashboard keeps showing whatever data it already has.
  const [refreshing, setRefreshing] = useState(false);
  // Hard error — only ever shown when there's no data at all to fall back on.
  const [error, setError] = useState<string | null>(null);
  // Soft warning — a background/manual refresh failed, but we're still showing
  // the last successful data. Never blanks the dashboard.
  const [staleWarning, setStaleWarning] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Tracks whether we've ever successfully rendered data (from SSR initialData or
  // a completed client fetch), so subsequent fetches — including the very first
  // background revalidation after an SSR-populated mount — are treated as
  // non-blocking refreshes rather than the initial blocking load.
  const hasLoadedOnceRef = useRef(Boolean(initialData));

  // IMPORTANT: these always derive from the full `submissions` array — never
  // `filtered`/`baseFiltered` — so the Agent Name (and channel/source) dropdown
  // options never disappear just because the current date/channel filter
  // happens to match zero records for that agent. See lib/dashboard-calculations.ts.
  const agents = useMemo(() => getAllAgents(submissions), [submissions]);
  const sources = useMemo(() => getAllSources(submissions), [submissions]);
  const channels = useMemo(() => getAllChannels(submissions), [submissions]);

  // Filters are preserved automatically — refreshing only replaces `submissions`,
  // never resets `filters`.
  //
  // Every change is sanitized against known-safe shapes before it reaches state:
  // dates must be valid YYYY-MM-DD, and agent/channel must be "all" or a value the
  // server actually returned. This is defense-in-depth (today these values can only
  // come from trusted <select>/<input type="date"> controls) that also protects any
  // future change that wires filters to URL query parameters.
  const updateFilters = useCallback(
    (next: Partial<Filters>) => {
      setFilters((prev) => ({ ...prev, ...sanitizeFilterChange(next, prev, agents, channels) }));
    },
    [agents, channels]
  );

  // Stale-while-revalidate fetch. `force` bypasses the server's short cache
  // (used by the manual Refresh Data button); a plain background/mount fetch
  // does not, so it's cheap even if several tabs/managers trigger it at once.
  const fetchData = useCallback(async (force = false) => {
    const isInitialLoad = !hasLoadedOnceRef.current;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setStaleWarning(false);

    try {
      // This is the ONLY query parameter ever sent to /api/jotform, and only
      // for a manual refresh. Date range, Agent Name, and Contact Channel are
      // never sent here — they're applied client-side (see getFiltered/
      // getBaseFiltered below) against the single full submissions payload
      // this endpoint always returns.
      const url = force ? "/api/jotform?force=true" : "/api/jotform";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      setSubmissions(json.submissions ?? []);
      setLastFetchedUTC(json.fetchedAtUTC ?? new Date().toISOString());
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "ไม่สามารถดึงข้อมูลจาก Jotform ได้";
      if (isInitialLoad) {
        // Nothing on screen to fall back to — this is a hard error state.
        setError(message);
      } else {
        // Dashboard already has good data showing — never blank it. Surface a
        // small, non-blocking warning instead and keep the last data as-is.
        setStaleWarning(true);
      }
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Always revalidate in the background after mount — whether we had SSR
  // initialData (common case: this just tops up anything that changed since
  // the server render) or not (this becomes the initial blocking load).
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefreshClick = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  // Recomputed whenever fresh data lands — real "today" in Asia/Bangkok, not
  // frozen at mount time.
  const todayStr = useMemo(() => todayBangkokStr(), [lastFetchedUTC]);

  const filtered = useMemo(() => getFiltered(submissions, filters, todayStr), [submissions, filters, todayStr]);
  const baseFiltered = useMemo(() => getBaseFiltered(submissions, filters, todayStr), [submissions, filters, todayStr]);

  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const closingData = useMemo(() => computeClosingData(kpis, GOLD, BRONZE), [kpis]);
  const activityBreakdown = useMemo(() => computeActivityBreakdown(filtered), [filtered]);
  const moneyMapData = useMemo(() => computeMoneyMapData(filtered, GOLD, BRONZE), [filtered]);
  const channelData = useMemo(() => computeChannelData(filtered, channels), [filtered, channels]);
  const sourceData = useMemo(() => computeSourceData(filtered, sources), [filtered, sources]);
  const agentTable = useMemo(() => computeAgentTable(baseFiltered, agents), [baseFiltered, agents]);
  const pepInsight = useMemo(
    () => computePepInsight(filters.agentFilter, baseFiltered, agents),
    [filters.agentFilter, baseFiltered, agents]
  );

  // One-time prefill source for the PEP Notes panel's editable fields — reuses
  // the SAME auto-computed "gap" focus/question already shown read-only in
  // PepInsightCard, so the manager starts from a sensible suggestion and can
  // freely edit or replace it before saving to Supabase.
  const suggestedRecommendation = useMemo(
    () => (pepInsight && !pepInsight.empty && pepInsight.gapKey ? PEP_META[pepInsight.gapKey].focus : ""),
    [pepInsight]
  );
  const suggestedQuestion = useMemo(
    () => (pepInsight && !pepInsight.empty && pepInsight.gapKey ? PEP_META[pepInsight.gapKey].question : ""),
    [pepInsight]
  );

  const showBlockingLoading = loading && submissions.length === 0;
  const showHardError = Boolean(error) && submissions.length === 0;
  const showStaleWarning = staleWarning && submissions.length > 0;
  const isBusy = loading || refreshing;

  return (
    <div className="dash-root">
      {/* HEADER */}
      <div className="dash-header">
        <div>
          <div className="dash-title-eyebrow">แดชบอร์ดผลงานตัวแทน</div>
          <h1 className="dash-title">{FORM_TITLE}</h1>
          <div className="dash-title-sub">
            ข้อมูลจริงจาก Jotform · {kpis.totalSubmissions} รายการที่แสดงผล จากทั้งหมด {submissions.length} รายการ ·
            เขตเวลา Asia/Bangkok (UTC+7)
          </div>
        </div>
        <div className="dash-sync">
          <button className="dash-refresh-btn" onClick={handleRefreshClick} disabled={isBusy}>
            {refreshing ? (
              <>
                <span className="dash-refresh-spinner" /> กำลังอัปเดตข้อมูล...
              </>
            ) : loading ? (
              <>
                <span className="dash-refresh-spinner" /> กำลังโหลด...
              </>
            ) : (
              <>↻ รีเฟรชข้อมูล</>
            )}
          </button>
          {lastFetchedUTC && !showHardError && (
            <div className="dash-sync-time">
              อัปเดตล่าสุด: {bangkokRefreshLabel(lastFetchedUTC)}
              {refreshing && <span className="dash-sync-refreshing"> · กำลังอัปเดตข้อมูล...</span>}
            </div>
          )}
          {showHardError && <div className="dash-sync-error">เกิดข้อผิดพลาด: {error}</div>}
        </div>
      </div>

      {showBlockingLoading && <div className="dash-loading-banner">กำลังดึงข้อมูลล่าสุดจาก Jotform…</div>}
      {showHardError && <div className="dash-error-banner">ไม่สามารถโหลดข้อมูลได้: {error}</div>}
      {showStaleWarning && (
        <div className="dash-stale-warning">
          ไม่สามารถอัปเดตข้อมูลล่าสุดได้ กำลังแสดงข้อมูลจากการอัปเดตครั้งก่อน
        </div>
      )}

      {/* FILTERS */}
      <FilterBar filters={filters} onChange={updateFilters} agents={agents} channels={channels} todayStr={todayStr} />

      {/* 1. OVERVIEW KPI */}
      <SectionLabel>ภาพรวม</SectionLabel>
      <div className="dash-kpi-grid">
        <KpiCard label="ลูกค้าทั้งหมด" value={kpis.totalCustomers} />
        <KpiCard label="จำนวนรายการที่ส่ง" value={kpis.totalSubmissions} />
        <KpiCard label="กิจกรรมทั้งหมด" value={kpis.totalActivities} />
        <KpiCard label="ทำ My Money Map" value={kpis.moneyMapDone} />
        <KpiCard label="การเสนอขาย" value={kpis.presentations} />
        <KpiCard label="ปิดการขายสำเร็จ" value={kpis.closedSales} />
      </div>

      <ActivitySummary breakdown={activityBreakdown} totalActivities={kpis.totalActivities} />

      {/* 2 & 3: CLOSING STATUS + ACTIVITY BREAKDOWN */}
      <div className="dash-grid-2">
        <ClosingStatusCard closingData={closingData} totalSubmissions={kpis.totalSubmissions} closedSales={kpis.closedSales} />
        <ActivityBreakdownCard data={activityBreakdown} />
      </div>

      {/* 4, 5, 6: MY MONEY MAP + CONTACT CHANNEL + LEAD SOURCE */}
      <div className="dash-grid-3">
        <MoneyMapCard data={moneyMapData} total={filtered.length} />
        <ChannelCard data={channelData} />
        <SourceCard data={sourceData} />
      </div>

      {/* 7. AGENT COMPARISON */}
      <SectionLabel>เปรียบเทียบผลงานตัวแทน</SectionLabel>
      <AgentTable rows={agentTable} selectedAgent={filters.agentFilter} />

      {/* 8. PEP INSIGHT */}
      <SectionLabel>PEP Insight</SectionLabel>
      <PepInsightCard agentFilter={filters.agentFilter} insight={pepInsight} />
      <div style={{ marginTop: 18 }}>
        <PepNotesPanel
          agentFilter={filters.agentFilter}
          todayStr={todayStr}
          suggestedRecommendation={suggestedRecommendation}
          suggestedQuestion={suggestedQuestion}
        />
      </div>
    </div>
  );
}
