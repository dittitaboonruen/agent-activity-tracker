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
  dataTimestampLabel,
  latestDataTimestamp,
} from "@/lib/date-utils";

import {
  sanitizeFilterChange,
} from "@/lib/validation";

import {
  getAllAgents,
  getAllSources,
  getAllChannels,
  getFiltered,
  getBaseFiltered,
  computeKpis,
  computeClosingData,
  computeActivityBreakdown,
  computeActivityGroups,
  computeMoneyMapData,
  computeChannelData,
  computeSourceData,
  computeAgentTable,
  computePepInsight,
  PEP_META,
} from "@/lib/dashboard-calculations";

import {
  SectionLabel,
  KpiCard,
} from "./ui";

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
import SkoolSummaryCard from "./SkoolSummaryCard";
import {
  dashboardAgentNames,
  dashboardPepName,
  dashboardLearningSelection,
  matchDashboardActivities,
  type DashboardAgent,
} from "@/lib/dashboard-agents";

const GOLD = "#C9A24B";
const BRONZE = "#4A3B1E";

const FORM_TITLE =
  "Agent Activity Tracker";

const DEFAULT_FILTERS: Filters = {
  dateQuick: "today",
  customStart: "",
  customEnd: "",
  agentFilter: "all",
  channelFilter: "all",
};

interface DashboardProps {
  initialData?:
    | JotformApiResponse
    | null;
}

export default function Dashboard({
  initialData = null,
}: DashboardProps) {
  const [
    submissions,
    setSubmissions,
  ] = useState<Submission[]>(
    initialData?.submissions ?? []
  );

  const [
    lastFetchedUTC,
    setLastFetchedUTC,
  ] = useState<
    string | null
  >(
    initialData?.fetchedAtUTC ??
      null
  );

  const [
    loading,
    setLoading,
  ] = useState(
    !initialData
  );

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    staleWarning,
    setStaleWarning,
  ] = useState(false);

  const [
    filters,
    setFilters,
  ] = useState<Filters>(
    DEFAULT_FILTERS
  );

  const hasLoadedOnceRef =
    useRef(
      Boolean(
        initialData
      )
    );

  const [masterAgents, setMasterAgents] = useState<DashboardAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const rosterRequestRef = useRef(0);
  const [learningRefreshKey, setLearningRefreshKey] = useState(0);

  const fetchAgents = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++rosterRequestRef.current;
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const response = await fetch("/api/dashboard-agents", { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.agents)) {
        if (response.status === 401 || response.status === 403) {
          if (!signal?.aborted && requestId === rosterRequestRef.current) {
            setMasterAgents([]);
            setFilters(current => ({ ...current, agentFilter: "all" }));
          }
        }
        throw new Error(body.error || "ไม่สามารถโหลดทะเบียนตัวแทนได้");
      }
      if (signal?.aborted || requestId !== rosterRequestRef.current) return;
      const roster = body.agents as DashboardAgent[];
      setMasterAgents(roster);
      const names = dashboardAgentNames(roster);
      setFilters(current => current.agentFilter === "all" || names.includes(current.agentFilter)
        ? current : { ...current, agentFilter: "all" });
    } catch (loadError) {
      if (!signal?.aborted && requestId === rosterRequestRef.current) {
        setAgentsError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดทะเบียนตัวแทนได้");
      }
    } finally {
      if (!signal?.aborted && requestId === rosterRequestRef.current) setAgentsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAgents(controller.signal);
    return () => controller.abort();
  }, [fetchAgents]);

  /* =========================================================
     FILTER OPTIONS
  ========================================================= */

  const agents =
    useMemo(
      () =>
        dashboardAgentNames(masterAgents),
      [masterAgents]
    );

  const activitySubmissions = useMemo(
    () => matchDashboardActivities(submissions, masterAgents),
    [submissions, masterAgents]
  );
  const activityAgents = useMemo(() => getAllAgents(activitySubmissions), [activitySubmissions]);
  const pepAgentFilter = dashboardPepName(filters.agentFilter, masterAgents);
  const learningSelection = dashboardLearningSelection(filters.agentFilter, masterAgents);

  const sources =
    useMemo(
      () =>
        getAllSources(
          submissions
        ),
      [submissions]
    );

  const channels =
    useMemo(
      () =>
        getAllChannels(
          submissions
        ),
      [submissions]
    );

  const updateFilters =
    useCallback(
      (
        next: Partial<Filters>
      ) => {
        setFilters(
          (prev) => ({
            ...prev,

            ...sanitizeFilterChange(
              next,
              prev,
              agents,
              channels
            ),
          })
        );
      },
      [
        agents,
        channels,
      ]
    );

  /* =========================================================
     FETCH JOTFORM DATA
  ========================================================= */

  const fetchData =
    useCallback(
      async (
        force = false
      ) => {
        const isInitialLoad =
          !hasLoadedOnceRef
            .current;

        if (
          isInitialLoad
        ) {
          setLoading(
            true
          );
        } else {
          setRefreshing(
            true
          );
        }

        setStaleWarning(
          false
        );

        try {
          const url =
            force
              ? "/api/jotform?force=true"
              : "/api/jotform";

          const res =
            await fetch(
              url,
              {
                cache:
                  "no-store",
              }
            );

          const json =
            await res.json();

          if (
            !res.ok
          ) {
            throw new Error(
              json?.error ||
                `Request failed with status ${res.status}`
            );
          }

          if (!Array.isArray(json.submissions)) throw new Error("ข้อมูลกิจกรรมจากระบบไม่สมบูรณ์ กรุณาลองใหม่");
          setSubmissions(json.submissions);

          setLastFetchedUTC(
            json.fetchedAtUTC ?? null
          );

          setError(
            null
          );
        } catch (
          err
        ) {
          const message =
            err instanceof
            Error
              ? err.message
              : "ไม่สามารถดึงข้อมูลจาก Jotform ได้";

          if (
            isInitialLoad
          ) {
            setError(
              message
            );
          } else {
            setStaleWarning(
              true
            );
          }
        } finally {
          hasLoadedOnceRef.current =
            true;

          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      []
    );

  useEffect(
    () => {
      fetchData();
    },
    [fetchData]
  );

  const handleRefreshClick =
    useCallback(
      () => {
        setLearningRefreshKey(value => value + 1);
        void fetchAgents();
        void fetchData(
          true
        );
      },
      [fetchData, fetchAgents]
    );

  /* =========================================================
     DATE
  ========================================================= */

  const todayStr =
    useMemo(
      () =>
        todayBangkokStr(),
      [lastFetchedUTC]
    );

  const currentYear =
    useMemo(
      () =>
        Number(
          todayStr.slice(
            0,
            4
          )
        ),
      [todayStr]
    );

  /* =========================================================
     FILTERED DATA
  ========================================================= */

  const filtered =
    useMemo(
      () =>
        getFiltered(
          activitySubmissions,
          filters,
          todayStr
        ),
      [
        activitySubmissions,
        filters,
        todayStr,
      ]
    );

  const baseFiltered =
    useMemo(
      () =>
        getBaseFiltered(
          activitySubmissions,
          filters,
          todayStr
        ),
      [
        activitySubmissions,
        filters,
        todayStr,
      ]
    );

  /* =========================================================
     KPI
  ========================================================= */

  const kpis =
    useMemo(
      () =>
        computeKpis(
          filtered
        ),
      [filtered]
    );

  /* =========================================================
     SALES PROCESS 3 GROUPS
  ========================================================= */

  const activityGroups =
    useMemo(
      () =>
        computeActivityGroups(
          filtered
        ),
      [filtered]
    );

  const prospectingTotal =
    activityGroups.find(
      (item) =>
        item.key ===
        "prospecting"
    )?.count ?? 0;

  const salesTotal =
    activityGroups.find(
      (item) =>
        item.key ===
        "sales"
    )?.count ?? 0;

  const serviceTotal =
    activityGroups.find(
      (item) =>
        item.key ===
        "service"
    )?.count ?? 0;

  /* =========================================================
     CHART DATA
  ========================================================= */

  const closingData =
    useMemo(
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

  const moneyMapData =
    useMemo(
      () =>
        computeMoneyMapData(
          filtered,
          GOLD,
          BRONZE
        ),
      [filtered]
    );

  const channelData =
    useMemo(
      () =>
        computeChannelData(
          filtered,
          channels
        ),
      [
        filtered,
        channels,
      ]
    );

  const sourceData =
    useMemo(
      () =>
        computeSourceData(
          filtered,
          sources
        ),
      [
        filtered,
        sources,
      ]
    );

  /* =========================================================
     AGENT TABLE
  ========================================================= */

  const agentTable =
    useMemo(
      () =>
        computeAgentTable(
          baseFiltered,
          agents
        ),
      [
        baseFiltered,
        agents,
      ]
    );

  /* =========================================================
     PEP INSIGHT
  ========================================================= */

  const pepInsight =
    useMemo(
      () =>
        computePepInsight(
          filters.agentFilter,
          baseFiltered,
          activityAgents
        ),
      [
        filters.agentFilter,
        baseFiltered,
        activityAgents,
      ]
    );

  const suggestedRecommendation =
    useMemo(
      () =>
        pepInsight &&
        !pepInsight.empty &&
        pepInsight.gapKey
          ? PEP_META[
              pepInsight
                .gapKey
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
              pepInsight
                .gapKey
            ].question
          : "",
      [pepInsight]
    );

  /* =========================================================
     UI STATES
  ========================================================= */

  const showBlockingLoading =
    loading &&
    submissions.length ===
      0;

  const showHardError =
    Boolean(
      error
    ) &&
    submissions.length ===
      0;

  const showStaleWarning = staleWarning && Boolean(lastFetchedUTC);

  const isBusy =
    loading ||
    refreshing;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="dash-root">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="dash-header">
        <div>
          <div className="dash-title-eyebrow">
            แดชบอร์ดผลงานตัวแทน
          </div>

          <h1 className="dash-title">
            {FORM_TITLE}
          </h1>

          <div className="dash-title-sub">
            กิจกรรมจาก Jotform · การเรียนจาก Skool · ผลสอบจาก Google Forms
            <br />
            รายชื่อจาก Agent Master · เขตเวลา Asia/Bangkok (UTC+7)
          </div>
        </div>

        <div className="dash-sync">
          <button
            className="dash-refresh-btn"
            onClick={
              handleRefreshClick
            }
            disabled={
              isBusy
            }
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
              <>
                ↻
                รีเฟรชข้อมูล
              </>
            )}
          </button>

          {lastFetchedUTC &&
            !showHardError && (
              <div className="dash-sync-time">
                ดึงข้อมูล Jotform ล่าสุด:{" "}
                {dataTimestampLabel(lastFetchedUTC)}

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

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <nav className="dash-section-nav" aria-label="ข้ามไปส่วนของแดชบอร์ด">
        <a href="#dashboard-activities">01 กิจกรรมและยอดขาย</a>
        <a href="#dashboard-learning">02 การเรียนและ Quiz</a>
        <a href="#dashboard-goals">03 เป้าหมายรายปีและ PEP</a>
      </nav>

      <p className="dash-filter-guide">
        เลือกชื่อตัวแทนเพื่อดูข้อมูลของคนนั้นในทั้ง 3 ส่วน · วันที่และช่องทางใช้กับกิจกรรมและ PEP Insight
      </p>

      <FilterBar
        filters={
          filters
        }
        onChange={
          updateFilters
        }
        agents={
          agents
        }
        agentsLoading={agentsLoading}
        channels={
          channels
        }
        todayStr={
          todayStr
        }
      />

      {agentsError && (
        <div className="dash-error-banner" role="alert">
          {agentsError}{" "}
          <button type="button" className="dash-refresh-btn" onClick={() => void fetchAgents()} disabled={agentsLoading}>
            ลองโหลดรายชื่ออีกครั้ง
          </button>
        </div>
      )}

      <section id="dashboard-activities" className="dash-data-section" aria-labelledby="dashboard-activities-title">
        <header className="dash-data-section-header">
          <div className="dash-data-section-heading">
            <span className="dash-data-section-number" aria-hidden="true">01</span>
            <h2 id="dashboard-activities-title">กิจกรรมและยอดขาย</h2>
            <span className="dash-data-source">Jotform</span>
          </div>
          <p className="dash-data-section-description">
            บันทึกกิจกรรมประจำวันและสถานะการขาย · My Money Map นับจากบันทึกกิจกรรมนี้
          </p>
          <p className="dash-data-section-context">
            {showBlockingLoading ? "กำลังโหลดกิจกรรม…" : showHardError ? "ยังโหลดกิจกรรมไม่สำเร็จ" : `แสดง ${kpis.totalSubmissions} รายการตามตัวกรอง จากข้อมูล Jotform ${submissions.length} รายการ`}
          </p>
          <p className="dash-data-section-context">
            ดึงข้อมูล Jotform ล่าสุด: {dataTimestampLabel(lastFetchedUTC, showBlockingLoading || showHardError ? "ยังโหลดข้อมูลไม่สำเร็จ" : "ยังไม่พบเวลาที่ดึงข้อมูล")}
            <br />บันทึกล่าสุดในตัวกรอง: {dataTimestampLabel(latestDataTimestamp(filtered.map(row => row.createdAtUTC)), filtered.length ? "ยังไม่พบเวลาบันทึก" : "ยังไม่มีบันทึกในตัวกรองนี้")}

          </p>
        </header>

        {/* =====================================================
            LOADING / ERROR
        ===================================================== */}

        {showBlockingLoading && (
          <div className="dash-loading-banner" role="status">
            กำลังดึงข้อมูลล่าสุดจาก
            Jotform…
          </div>
        )}

        {showHardError && (
          <div className="dash-error-banner" role="alert">
            ไม่สามารถโหลดข้อมูลกิจกรรมจาก Jotform ได้:{" "}
            {error}
          </div>
        )}

        {showStaleWarning && (
          <div className="dash-stale-warning">
            ไม่สามารถอัปเดตข้อมูลล่าสุดได้
            กำลังแสดงข้อมูลจากการอัปเดตครั้งก่อน
          </div>
        )}

        {!showBlockingLoading && !showHardError && filtered.length === 0 && (
          <div className="dash-loading-banner" role="status">
            {filters.agentFilter === "all" ? "ไม่มีบันทึกกิจกรรมในช่วงวันที่และช่องทางที่เลือก" : `ไม่มีบันทึกกิจกรรมของ ${filters.agentFilter} ในช่วงวันที่และช่องทางที่เลือก`}
            <br />ข้อมูลการเรียน ผลสอบ เป้าหมาย และบันทึก PEP ดูได้ในส่วนถัดไป
          </div>
        )}

        {!showBlockingLoading && !showHardError && filtered.length > 0 && (
          <>
            {/* =====================================================
                OVERVIEW KPI
            ===================================================== */}

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
                label="กิจกรรมทั้งหมด"
                value={
                  kpis.totalActivities
                }
              />

              <KpiCard
                label="หารายชื่อ"
                value={
                  prospectingTotal
                }
              />

              <KpiCard
                label="ขาย"
                value={
                  salesTotal
                }
              />

              <KpiCard
                label="บริการ"
                value={
                  serviceTotal
                }
              />

              <KpiCard
                label="ทำ My Money Map"
                value={
                  kpis.moneyMapDone
                }
              />
            </div>

            {/* =====================================================
                SALES PROCESS SUMMARY
            ===================================================== */}

            <ActivitySummary
              breakdown={
                activityBreakdown
              }
              totalActivities={
                kpis.totalActivities
              }
            />

            {/* =====================================================
                CLOSING + 9 STEPS
            ===================================================== */}

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

            {/* =====================================================
                MONEY MAP / CHANNEL / SOURCE
            ===================================================== */}

            <div className="dash-grid-3">
              <MoneyMapCard
                data={
                  moneyMapData
                }
                total={
                  filtered.length
                }
              />

              <ChannelCard
                data={
                  channelData
                }
              />

              <SourceCard
                data={
                  sourceData
                }
              />
            </div>

          </>
        )}
      </section>

      <section id="dashboard-learning" className="dash-data-section" aria-labelledby="dashboard-learning-title">
        <header className="dash-data-section-header">
          <div className="dash-data-section-heading">
            <span className="dash-data-section-number" aria-hidden="true">02</span>
            <h2 id="dashboard-learning-title">การเรียนและ Quiz</h2>
            <span className="dash-data-source">Skool · Google Forms</span>
          </div>
          <p className="dash-data-section-description">
            ความคืบหน้า Skool จาก CSV ที่นำเข้าทุกวันศุกร์ · ผลสอบ Google Forms รับผ่าน Apps Script
          </p>
          <p className="dash-data-section-context">
            แสดงตามชื่อตัวแทนที่เลือก · วันที่และช่องทางกิจกรรมไม่มีผลกับส่วนนี้
          </p>
        </header>

        {/* =====================================================
            SKOOL LEARNING SUMMARY
        ===================================================== */}

        <SkoolSummaryCard
          key={`${learningSelection ?? "unresolved"}:${learningRefreshKey}`}
          agentSelection={learningSelection}
          agentName={filters.agentFilter === "all" ? undefined : filters.agentFilter}
        />

      </section>

      <section id="dashboard-goals" className="dash-data-section" aria-labelledby="dashboard-goals-title">
        <header className="dash-data-section-header">
          <div className="dash-data-section-heading">
            <span className="dash-data-section-number" aria-hidden="true">03</span>
            <h2 id="dashboard-goals-title">เป้าหมายรายปีและ PEP</h2>
            <span className="dash-data-source">Annual Target · PEP</span>
          </div>
          <p className="dash-data-section-description">
            เป้าหมายประจำปี {currentYear + 543} และการติดตามตัวแทนรายบุคคล
          </p>
          <p className="dash-data-section-context">
            เป้าหมายรายปีและประวัติ PEP แสดงตามชื่อ · PEP Insight วิเคราะห์กิจกรรมตามวันที่และช่องทางที่เลือก
          </p>
        </header>

        {/* =====================================================
            ANNUAL TARGET
        ===================================================== */}

        <div
          style={{
            marginTop: 18,
          }}
        >
          <AnnualTargetCard
            key={`${filters.agentFilter}:${currentYear}`}
            refreshKey={learningRefreshKey}
            agentFilter={
              filters.agentFilter
            }
            year={
              currentYear
            }
          />
        </div>

        {/* =====================================================
            PEP
        ===================================================== */}

        <SectionLabel>
          PEP Insight
        </SectionLabel>

        {showBlockingLoading ? (
          <p className="dash-loading-banner" role="status">กำลังโหลดกิจกรรมสำหรับ PEP Insight…</p>
        ) : showHardError ? (
          <p className="dash-error-banner" role="alert">ยังวิเคราะห์ PEP Insight ไม่ได้ เพราะโหลดกิจกรรมไม่สำเร็จ · ยังบันทึก PEP ด้วยตนเองได้</p>
        ) : (
          <PepInsightCard
            agentFilter={
              filters.agentFilter
            }
            insight={
              pepInsight
            }
          />
        )}

        <div
          style={{
            marginTop: 18,
          }}
        >
          <PepNotesPanel
            key={pepAgentFilter}
            refreshKey={learningRefreshKey}
            agentFilter={
              pepAgentFilter
            }
            todayStr={
              todayStr
            }
            suggestedRecommendation={
              suggestedRecommendation
            }
            suggestedQuestion={
              suggestedQuestion
            }
          />
        </div>
      </section>

      <section id="dashboard-agent-performance" className="dash-data-section" aria-labelledby="dashboard-agent-performance-title">
        <h2 id="dashboard-agent-performance-title" className="dash-section-title">เปรียบเทียบผลงานตัวแทน</h2>
        <p className="dash-filter-guide">
          ตารางท้ายหน้าแสดงตัวแทนตามสิทธิ์และเน้นชื่อที่เลือก · ใช้วันที่และช่องทางเดียวกับกิจกรรม
          <br />ขีด (—) หมายถึงไม่มีบันทึกในช่วงที่เลือก · 0 หมายถึงมีบันทึกแต่ไม่มีรายการในหมวดนั้น
        </p>
        {agentsLoading ? (
          <p className="dash-loading-banner" role="status">กำลังโหลดรายชื่อตัวแทน…</p>
        ) : agentsError ? (
          <p className="dash-error-banner" role="alert">ยังแสดงตารางไม่ได้ เพราะโหลดรายชื่อตัวแทนไม่สำเร็จ</p>
        ) : showBlockingLoading ? (
          <p className="dash-loading-banner" role="status">กำลังโหลดกิจกรรมสำหรับตารางเปรียบเทียบ…</p>
        ) : showHardError ? (
          <p className="dash-error-banner" role="alert">ยังแสดงตารางไม่ได้ เพราะโหลดกิจกรรมไม่สำเร็จ</p>
        ) : (
          <AgentTable
            rows={agentTable}
            selectedAgent={filters.agentFilter}
            recordedAgents={Array.from(new Set(baseFiltered.map(row => row.agent)))}
          />
        )}
      </section>
    </div>
  );
}
