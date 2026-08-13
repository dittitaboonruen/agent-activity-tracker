"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Filters, Submission } from "@/types";
import { todayBangkokStr, bangkokRefreshLabel } from "@/lib/date-utils";
import {
  uniq,
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
} from "@/lib/dashboard-calculations";

import { SectionLabel, KpiCard } from "./ui";
import FilterBar from "./FilterBar";
import ClosingStatusCard from "./ClosingStatusCard";
import ActivityBreakdownCard from "./ActivityBreakdownCard";
import MoneyMapCard from "./MoneyMapCard";
import ChannelCard from "./ChannelCard";
import SourceCard from "./SourceCard";
import AgentTable from "./AgentTable";
import PepInsightCard from "./PepInsightCard";

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

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedUTC, setLastFetchedUTC] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Filters are preserved automatically — refreshing only replaces `submissions`,
  // never resets `filters`.
  const updateFilters = useCallback((next: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jotform", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      setSubmissions(json.submissions ?? []);
      setLastFetchedUTC(json.fetchedAtUTC ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถดึงข้อมูลจาก Jotform ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recomputed on every refresh — real "today" in Asia/Bangkok, not the last render's.
  const todayStr = useMemo(() => todayBangkokStr(), [lastFetchedUTC]);

  const agents = useMemo(() => uniq(submissions.map((s) => s.agent)).filter(Boolean).sort(), [submissions]);
  const sources = useMemo(() => uniq(submissions.map((s) => s.source)).filter(Boolean).sort(), [submissions]);
  const channels = useMemo(() => uniq(submissions.map((s) => s.channel)).filter(Boolean).sort(), [submissions]);

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
          <button className="dash-refresh-btn" onClick={fetchData} disabled={loading}>
            {loading ? (
              <>
                <span className="dash-refresh-spinner" /> กำลังโหลด...
              </>
            ) : (
              <>↻ รีเฟรชข้อมูล</>
            )}
          </button>
          {lastFetchedUTC && !error && (
            <div className="dash-sync-time">อัปเดตล่าสุด: {bangkokRefreshLabel(lastFetchedUTC)}</div>
          )}
          {error && <div className="dash-sync-error">เกิดข้อผิดพลาด: {error}</div>}
        </div>
      </div>

      {loading && submissions.length === 0 && (
        <div className="dash-loading-banner">กำลังดึงข้อมูลล่าสุดจาก Jotform…</div>
      )}
      {error && submissions.length === 0 && (
        <div className="dash-error-banner">
          ไม่สามารถโหลดข้อมูลได้: {error} — ตรวจสอบว่าได้ตั้งค่า JOTFORM_API_KEY และ JOTFORM_FORM_ID ถูกต้อง
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
    </div>
  );
}
