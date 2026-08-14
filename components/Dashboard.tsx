"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  Filters,
  Submission,
  JotformApiResponse,
} from "@/types";

import {
  todayBangkokStr,
  bangkokRefreshLabel,
} from "@/lib/date-utils";

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
import AnnualTargetCard from "./AnnualTargetCard";
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
  initialData?: JotformApiResponse | null;
}

export default function Dashboard({
  initialData = null,
}: DashboardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>(
    initialData?.submissions ?? []
  );

  const [lastFetchedUTC, setLastFetchedUTC] = useState<string | null>(
    initialData?.fetchedAtUTC ?? null
  );

  const [loading, setLoading] = useState(!initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleWarning, setStaleWarning] = useState(false);

  const [filters, setFilters] =
    useState<Filters>(DEFAULT_FILTERS);

  const hasLoadedOnceRef = useRef(Boolean(initialData));

  const agents = useMemo(
    () => getAllAgents(submissions),
    [submissions]
  );

  const sources = useMemo(
    () => getAllSources(submissions),
    [submissions]
  );

  const channels = useMemo(
    () => getAllChannels(submissions),
    [submissions]
  );

  const updateFilters = useCallback(
    (next: Partial<Filters>) => {
      setFilters((prev) => ({
        ...prev,
        ...sanitizeFilterChange(
          next,
          prev,
          agents,
          channels
        ),
      }));
    },
    [agents, channels]
  );

  const fetchData = useCallback(async (force = false) => {
    const isInitialLoad =
      !hasLoadedOnceRef.current;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setStaleWarning(false);

    try {
      const url = force
        ? "/api/jotform?force=true"
        : "/api/jotform";

      const res = await fetch(url, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.error ||
            `Request failed with status ${res.status}`
        );
      }

      setSubmissions(
        json.submissions ?? []
      );

      setLastFetchedUTC(
        json.fetchedAtUTC ??
          new Date().toISOString()
      );

      setError(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "ไม่สามารถดึงข้อมูลจาก Jotform ได้";

      if (isInitialLoad) {
        setError(message);
      } else {
        setStaleWarning(true);
      }
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefreshClick =
    useCallback(() => {
      fetchData(true);
    }, [fetchData]);

  const todayStr = useMemo(
    () => todayBangkokStr(),
    [lastFetchedUTC]
  );

  const currentYear = useMemo(
    () => Number(todayStr.slice(0, 4)),
    [todayStr]
  );

  const filtered = useMemo(
    () =>
      getFiltered(
        submissions,
        filters,
        todayStr
      ),
    [submissions, filters, todayStr]
  );

  const baseFiltered = useMemo(
    () =>
      getBaseFiltered(
        submissions,
        filters,
        todayStr
      ),
    [submissions, filters, todayStr]
  );

  const kpis = useMemo(
    () => computeKpis(filtered),
    [filtered]
  );

  const closingData = useMemo(
    () =>
      computeClosingData(
        kpis,
        GOLD,
        BRONZE
      ),
    [kpis]
  );

  const activityBreakdown =
    useMemo(
      () =>
        computeActivityBreakdown(
          filtered
        ),
      [filtered]
    );

  const moneyMapData = useMemo(
    () =>
      computeMoneyMapData(
        filtered,
        GOLD,
        BRONZE
      ),
    [filtered]
  );

  const channelData = useMemo(
    () =>
      computeChannelData(
        filtered,
        channels
      ),
    [filtered, channels]
  );

  const sourceData = useMemo(
    () =>
      computeSourceData(
        filtered,
        sources
      ),
    [filtered, sources]
  );

  const agentTable = useMemo(
    () =>
      computeAgentTable(
        baseFiltered,
        agents
      ),
    [baseFiltered, agents]
  );

  const pepInsight = useMemo(
    () =>
      computePepInsight(
        filters.agentFilter,
        baseFiltered,
        agents
      ),
    [
      filters.agentFilter,
      baseFiltered,
      agents,
    ]
  );

  const suggestedRecommendation =
    useMemo(
      () =>
        pepInsight &&
        !pepInsight.empty &&
        pepInsight.gapKey
          ? PEP_META[
              pepInsight.gapKey
            ].focus
          : "",
      [pepInsight]
    );

  const suggestedQuestion =
    useMemo(
      () =>
        pepInsight &&
        !pepInsight.empty &&
        pepInsight.gapKey
          ? PEP_META[
              pepInsight.gapKey
            ].question
          : "",
      [pepInsight]
    );

  const showBlockingLoading =
    loading &&
    submissions.length === 0;

  const showHardError =
    Boolean(error) &&
    submissions.length === 0;

  const showStaleWarning =
    staleWarning &&
    submissions.length > 0;

  const isBusy =
    loading || refreshing;

  return (
    <div className="dash-root">
      {/* HEADER */}
      <div className="dash-header">
        <div>
          <div className="dash-title-eyebrow">
            แดชบอร์ดผลงานตัวแทน
          </div>

          <h1 className="dash-title">
            {FORM_TITLE}
          </h1>

          <div className="dash-title-sub">
            ข้อมูลจริงจาก Jotform ·{" "}
            {kpis.totalSubmissions}{" "}
            รายการที่แสดงผล จากทั้งหมด{" "}
            {submissions.length} รายการ ·
            เขตเวลา Asia/Bangkok
            (UTC+7)
          </div>
        </div>

        <div className="dash-sync">
          <button
            className="dash-refresh-btn"
            onClick={
              handleRefreshClick
            }
            disabled={isBusy}
          >
            {refreshing ? (
              <>
                <span className="dash-refresh-spinner" />{" "}
                กำลังอัปเดตข้อมูล...
              </>
            ) : loading ? (
              <>
                <span className="dash-refresh-spinner" />{" "}
                กำลังโหลด...
              </>
            ) : (
              <>↻ รีเฟรชข้อมูล</>
            )}
          </button>

          {lastFetchedUTC &&
            !showHardError && (
              <div className="dash-sync-time">
                อัปเดตล่าสุด:{" "}
                {bangkokRefreshLabel(
                  lastFetchedUTC
                )}

                {refreshing && (
                  <span className="dash-sync-refreshing">
                    {" "}
                    ·
                    กำลังอัปเดตข้อมูล...
                  </span>
                )}
              </div>
            )}

          {showHardError && (
            <div className="dash-sync-error">
              เกิดข้อผิดพลาด:{" "}
              {error}
            </div>
          )}
        </div>
      </div>

      {showBlockingLoading && (
        <div className="dash-loading-banner">
          กำลังดึงข้อมูลล่าสุดจาก
          Jotform…
        </div>
      )}

      {showHardError && (
        <div className="dash-error-banner">
          ไม่สามารถโหลดข้อมูลได้:{" "}
          {error}
        </div>
      )}

      {showStaleWarning && (
        <div className="dash-stale-warning">
          ไม่สามารถอัปเดตข้อมูลล่าสุดได้
          กำลังแสดงข้อมูลจากการอัปเดตครั้งก่อน
        </div>
      )}

      {/* FILTERS */}
      <FilterBar
        filters={filters}
        onChange={updateFilters}
        agents={agents}
        channels={channels}
        todayStr={todayStr}
      />

      {/* 1. OVERVIEW KPI */}
      <SectionLabel>
        ภาพรวม
      </SectionLabel>

      <div className="dash-kpi-grid">
        <KpiCard
          label="ลูกค้าทั้งหมด"
          value={
            kpis.totalCustomers
          }
        />

        <KpiCard
          label="จำนวนรายการที่ส่ง"
          value={
            kpis.totalSubmissions
          }
        />

        <KpiCard
          label="กิจกรรมทั้งหมด"
          value={
            kpis.totalActivities
          }
        />

        <KpiCard
          label="ทำ My Money Map"
          value={
            kpis.moneyMapDone
          }
        />

        <KpiCard
          label="การเสนอขาย"
          value={
            kpis.presentations
          }
        />

        <KpiCard
          label="ปิดการขายสำเร็จ"
          value={
            kpis.closedSales
          }
        />
      </div>

      <ActivitySummary
        breakdown={
          activityBreakdown
        }
        totalActivities={
          kpis.totalActivities
        }
      />

      {/* ANNUAL TARGET */}
      <div
        style={{
          marginTop: 18,
        }}
      >
        <AnnualTargetCard
          agentFilter={
            filters.agentFilter
          }
          year={currentYear}
        />
      </div>

      {/* 2 & 3 */}
      <div className="dash-grid-2">
        <ClosingStatusCard
          closingData={
            closingData
          }
          totalSubmissions={
            kpis.totalSubmissions
          }
          closedSales={
            kpis.closedSales
          }
        />

        <ActivityBreakdownCard
          data={
            activityBreakdown
          }
        />
      </div>

      {/* 4, 5, 6 */}
      <div className="dash-grid-3">
        <MoneyMapCard
          data={moneyMapData}
          total={
            filtered.length
          }
        />

        <ChannelCard
          data={channelData}
        />

        <SourceCard
          data={sourceData}
        />
      </div>

      {/* AGENT COMPARISON */}
      <SectionLabel>
        เปรียบเทียบผลงานตัวแทน
      </SectionLabel>

      <AgentTable
        rows={agentTable}
        selectedAgent={
          filters.agentFilter
        }
      />

      {/* PEP */}
      <SectionLabel>
        PEP Insight
      </SectionLabel>

      <PepInsightCard
        agentFilter={
          filters.agentFilter
        }
        insight={pepInsight}
      />

      <div
        style={{
          marginTop: 18,
        }}
      >
        <PepNotesPanel
          agentFilter={
            filters.agentFilter
          }
          todayStr={todayStr}
          suggestedRecommendation={
            suggestedRecommendation
          }
          suggestedQuestion={
            suggestedQuestion
          }
        />
      </div>
    </div>
  );
}
