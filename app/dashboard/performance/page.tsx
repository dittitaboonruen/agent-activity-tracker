"use client";

import { useEffect, useMemo, useState } from "react";

import PageTopBar from "@/components/PageTopBar";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type DailyProduction = {
  production_date: string;
  agent_code: string | null;
  agent_name: string;
  agent_nickname: string | null;

  aia_case_submitted: number;
  aia_case_approved: number;
  aia_fyp_submitted: number;
  aia_fyp_approved: number;
  aia_fyc_approved: number;

  pa_case: number;
  pa_fyp: number;
  pa_fyc: number;
};

type AgentMaster = {
  agent_code: string | null;
  agent_name: string;
  agent_nickname: string | null;
  unit_id?: number | null;
};

type Unit = {
  id: number;
  unit_code: string | null;
  unit_name: string;
};

type Totals = {
  caseSubmitted: number;
  caseApproved: number;
  fypSubmitted: number;
  fypApproved: number;
  fycApproved: number;
  paCase: number;
  paFyp: number;
  paFyc: number;
};

type AgentSummary = {
  code: string;
  name: string;
  nickname: string;
  unit: string;
  month: Totals;
  ytd: Totals;
  approvedMonths: number;
};

type UnitLine = {
  label: string; // ชื่อเดือน หรือ ชื่อหน่วย
  month: Totals;
  ytd: Totals;
  activeAgents: number;
};

type View = "agent" | "unit" | "rank";

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                           */
/* ------------------------------------------------------------------ */

const MONTHS: [string, string][] = [
  ["01", "มกราคม"],
  ["02", "กุมภาพันธ์"],
  ["03", "มีนาคม"],
  ["04", "เมษายน"],
  ["05", "พฤษภาคม"],
  ["06", "มิถุนายน"],
  ["07", "กรกฎาคม"],
  ["08", "สิงหาคม"],
  ["09", "กันยายน"],
  ["10", "ตุลาคม"],
  ["11", "พฤศจิกายน"],
  ["12", "ธันวาคม"],
];

const NO_UNIT = "ไม่ระบุหน่วย";

const EMPTY: Totals = {
  caseSubmitted: 0,
  caseApproved: 0,
  fypSubmitted: 0,
  fypApproved: 0,
  fycApproved: 0,
  paCase: 0,
  paFyp: 0,
  paFyc: 0,
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function currentBangkokYearMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  return {
    year: parts.find((p) => p.type === "year")?.value ?? "",
    month: parts.find((p) => p.type === "month")?.value ?? "",
  };
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function n(value: unknown) {
  return Number(value ?? 0) || 0;
}

function sumRows(list: DailyProduction[]): Totals {
  return list.reduce(
    (acc, row) => ({
      caseSubmitted: acc.caseSubmitted + n(row.aia_case_submitted),
      caseApproved: acc.caseApproved + n(row.aia_case_approved),
      fypSubmitted: acc.fypSubmitted + n(row.aia_fyp_submitted),
      fypApproved: acc.fypApproved + n(row.aia_fyp_approved),
      fycApproved: acc.fycApproved + n(row.aia_fyc_approved),
      paCase: acc.paCase + n(row.pa_case),
      paFyp: acc.paFyp + n(row.pa_fyp),
      paFyc: acc.paFyc + n(row.pa_fyc),
    }),
    { ...EMPTY }
  );
}

function addTotals(a: Totals, b: Totals): Totals {
  return {
    caseSubmitted: a.caseSubmitted + b.caseSubmitted,
    caseApproved: a.caseApproved + b.caseApproved,
    fypSubmitted: a.fypSubmitted + b.fypSubmitted,
    fypApproved: a.fypApproved + b.fypApproved,
    fycApproved: a.fycApproved + b.fycApproved,
    paCase: a.paCase + b.paCase,
    paFyp: a.paFyp + b.paFyp,
    paFyc: a.paFyc + b.paFyc,
  };
}

// Active agent = คนที่มี Case อนุมัติ ≥ 1 ในเดือนนั้น
function countActive(list: DailyProduction[]) {
  const totalsByAgent = new Map<string, number>();
  list.forEach((row) => {
    totalsByAgent.set(
      row.agent_name,
      (totalsByAgent.get(row.agent_name) ?? 0) + n(row.aia_case_approved)
    );
  });
  return Array.from(totalsByAgent.values()).filter((v) => v > 0).length;
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function PerformanceDashboardPage() {
  const initial = currentBangkokYearMonth();

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [view, setView] = useState<View>("agent");
  const [selectedUnit, setSelectedUnit] = useState("");

  const [rows, setRows] = useState<DailyProduction[]>([]);
  const [agents, setAgents] = useState<AgentMaster[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [productionResponse, agentResponse] = await Promise.all([
        fetch("/api/monthly-performance", { cache: "no-store" }),
        fetch("/api/agent-master", { cache: "no-store" }),
      ]);

      const data = await productionResponse.json();

      if (!productionResponse.ok) {
        setRows([]);
        setError(
          data.error || "ไม่สามารถโหลดข้อมูล Monthly Performance ได้"
        );
        return;
      }

      setRows(data.rows ?? []);

      // โหลดหน่วยไม่ได้ก็ยังแสดงหน้าได้ (จะขึ้น "ไม่ระบุหน่วย")
      if (agentResponse.ok) {
        const agentData = await agentResponse.json();
        setAgents(agentData.agents ?? []);
        setUnits(agentData.units ?? []);
      }
    } catch (error) {
      console.error("[monthly-performance-page] load error:", error);
      setRows([]);
      setError("เกิดข้อผิดพลาดในการโหลด Monthly Performance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* ---------- หน่วยของตัวแทน ---------- */

  // หน่วยมาจาก unit_id ใน Agent Master (ตั้งที่หน้า จัดการตัวแทน)
  const unitLookup = useMemo(() => {
    const unitName = new Map<number, string>();
    units.forEach((u) => unitName.set(u.id, u.unit_name));

    const byCode = new Map<string, string>();
    const byName = new Map<string, string>();

    agents.forEach((agent) => {
      const unit = agent.unit_id ? unitName.get(agent.unit_id) : undefined;
      if (!unit) return;
      if (agent.agent_code) byCode.set(agent.agent_code, unit);
      byName.set(agent.agent_name, unit);
    });

    return (row: { agent_code: string | null; agent_name: string }) =>
      (row.agent_code && byCode.get(row.agent_code)) ||
      byName.get(row.agent_name) ||
      NO_UNIT;
  }, [agents, units]);

  const unitList = useMemo(() => {
    // แสดงเฉพาะหน่วยที่มีตัวแทนสังกัดอยู่จริง (หน่วยว่างไม่ต้องโชว์)
    const usedIds = new Set(agents.map((a) => a.unit_id).filter(Boolean));
    const names = units
      .filter((u) => usedIds.has(u.id))
      .map((u) => u.unit_name);
    const hasNoUnit = rows.some((r) => unitLookup(r) === NO_UNIT);
    return [...names, ...(hasNoUnit ? [NO_UNIT] : [])];
  }, [units, agents, rows, unitLookup]);

  // เลือกหน่วยแรกให้อัตโนมัติเมื่อโหลดเสร็จ
  useEffect(() => {
    if (!selectedUnit && unitList.length) setSelectedUnit(unitList[0]);
  }, [unitList, selectedUnit]);

  /* ---------- ช่วงเวลา ---------- */

  const selectedMonth = `${year}-${month}`;

  const monthRows = useMemo(
    () => rows.filter((r) => r.production_date.startsWith(selectedMonth)),
    [rows, selectedMonth]
  );

  const ytdRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.production_date >= `${year}-01-01` &&
          r.production_date <= `${year}-${month}-31`
      ),
    [rows, year, month]
  );

  /* ---------- 🔵 รายตัวแทน (เรียงตาม FYC) ---------- */

  const agentSummary = useMemo(() => {
    const names = Array.from(
      new Set(ytdRows.map((r) => r.agent_name).filter(Boolean))
    );

    const list = names.map((agentName): AgentSummary => {
      const monthly = monthRows.filter((r) => r.agent_name === agentName);
      const ytd = ytdRows.filter((r) => r.agent_name === agentName);

      const latest =
        [...ytd].sort((a, b) =>
          b.production_date.localeCompare(a.production_date)
        )[0] ?? null;

      const approvedMonths = new Set(
        ytd
          .filter((r) => n(r.aia_case_approved) > 0)
          .map((r) => r.production_date.slice(0, 7))
      ).size;

      return {
        code: latest?.agent_code ?? "",
        name: agentName,
        nickname: latest?.agent_nickname ?? "",
        unit: latest ? unitLookup(latest) : NO_UNIT,
        month: sumRows(monthly),
        ytd: sumRows(ytd),
        approvedMonths,
      };
    });

    // เรียง FYC เดือนนี้มากไปน้อย ถ้าเท่ากันดู FYC YTD
    return list.sort(
      (a, b) =>
        b.month.fycApproved - a.month.fycApproved ||
        b.ytd.fycApproved - a.ytd.fycApproved
    );
  }, [monthRows, ytdRows, unitLookup]);

  const totals = useMemo(
    () => ({
      month: sumRows(monthRows),
      ytd: sumRows(ytdRows),
    }),
    [monthRows, ytdRows]
  );

  /* ---------- 🩷 รายหน่วย (ม.ค. → เดือนที่เลือก) ---------- */

  const unitMonthly = useMemo((): UnitLine[] => {
    const unitRows = rows.filter(
      (r) => r.production_date.startsWith(year) && unitLookup(r) === selectedUnit
    );

    let running: Totals = { ...EMPTY };

    return MONTHS.filter(([m]) => m <= month).map(([m, label]) => {
      const inMonth = unitRows.filter((r) =>
        r.production_date.startsWith(`${year}-${m}`)
      );
      const monthTotals = sumRows(inMonth);
      running = addTotals(running, monthTotals);

      return {
        label,
        month: monthTotals,
        ytd: running,
        activeAgents: countActive(inMonth),
      };
    });
  }, [rows, year, month, selectedUnit, unitLookup]);

  /* ---------- 🟢 อันดับเครือ (เดือนที่เลือก) ---------- */

  const unitRanking = useMemo((): UnitLine[] => {
    return unitList
      .map((unit) => {
        const inMonth = monthRows.filter((r) => unitLookup(r) === unit);
        const inYtd = ytdRows.filter((r) => unitLookup(r) === unit);

        return {
          label: unit,
          month: sumRows(inMonth),
          ytd: sumRows(inYtd),
          activeAgents: countActive(inMonth),
        };
      })
      .filter((line) => line.label !== NO_UNIT || line.ytd.caseApproved > 0 || line.ytd.fycApproved > 0)
      .sort(
        (a, b) =>
          b.month.fycApproved - a.month.fycApproved ||
          b.ytd.fycApproved - a.ytd.fycApproved
      );
  }, [unitList, monthRows, ytdRows, unitLookup]);

  const monthLabel = MONTHS.find(([m]) => m === month)?.[1] ?? "";
  const thaiYear = Number(year) + 543;

  /* ---------------------------------------------------------------- */
  /* RENDER                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--rp-page-gradient), var(--bg)",
        color: "var(--cream)",
        padding: "24px 18px 60px",
        transition: "background .2s ease, color .2s ease",
      }}
    >
      <div style={{ maxWidth: 1900, margin: "0 auto" }}>
        <PageTopBar />

        {/* HEADER */}
        <div style={{ marginBottom: 26 }}>
          <div
            style={{
              color: "var(--gold)",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2,
            }}
          >
            ROYAL PARTNER · PERFORMANCE
          </div>

          <h1 style={{ fontSize: 34, margin: "8px 0", color: "var(--cream)" }}>
            Monthly Performance
          </h1>

          <div style={{ color: "var(--cream-muted)" }}>
            สรุปผลงานรายเดือน · YTD
          </div>
        </div>

        {/* FILTER + VIEW SWITCH */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: 14,
            padding: 14,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={filterStyle}
            >
              {MONTHS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={filterStyle}
            >
              {["2025", "2026", "2027", "2028", "2029", "2030"].map((value) => (
                <option key={value} value={value}>
                  {Number(value) + 543}
                </option>
              ))}
            </select>

            {view === "unit" && (
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                style={filterStyle}
              >
                {unitList.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              style={{ ...filterStyle, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "กำลังโหลด..." : "↻ รีเฟรช"}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 4,
              borderRadius: 999,
              border: "1px solid var(--hairline)",
              background: "var(--surface-alt)",
            }}
          >
            <ViewButton active={view === "agent"} onClick={() => setView("agent")}>
              รายตัวแทน
            </ViewButton>
            <ViewButton active={view === "unit"} onClick={() => setView("unit")}>
              รายหน่วย
            </ViewButton>
            <ViewButton active={view === "rank"} onClick={() => setView("rank")}>
              อันดับเครือ
            </ViewButton>
          </div>
        </div>

        {loading && (
          <div style={{ marginBottom: 16, color: "var(--cream-muted)" }}>
            กำลังโหลดข้อมูล...
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              border: "1px solid var(--rp-danger-border)",
              borderRadius: 10,
              color: "var(--rp-danger)",
            }}
          >
            {error}
          </div>
        )}

        {/* SUMMARY CARDS (ทั้งเครือ เดือนที่เลือก) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <SummaryCard
            label="AIA Case อนุมัติ"
            value={totals.month.caseApproved.toLocaleString()}
          />
          <SummaryCard
            label="AIA FYP อนุมัติ"
            value={money(totals.month.fypApproved)}
          />
          <SummaryCard
            label="AIA FYC อนุมัติ"
            value={money(totals.month.fycApproved)}
          />
          <SummaryCard
            label="Active Agent"
            value={countActive(monthRows).toLocaleString()}
          />
          <SummaryCard label="PA FYP" value={money(totals.month.paFyp)} />
          <SummaryCard label="PA FYC" value={money(totals.month.paFyc)} />
        </div>

        {/* ---------------- 🔵 รายตัวแทน ---------------- */}
        {view === "agent" && (
          <TableBox
            title={`ผลผลิตรายตัวแทน ${monthLabel} ${thaiYear}`}
            hint="เรียงตาม FYC อนุมัติของเดือนนี้ มากไปน้อย"
          >
            <table style={{ ...tableStyle, minWidth: 2000 }}>
              <thead>
                <tr style={{ background: "var(--rp-soft-gold)" }}>
                  <HeaderCell>No.</HeaderCell>
                  <HeaderCell>Code</HeaderCell>
                  <HeaderCell>Name</HeaderCell>
                  <HeaderCell>Nick Name</HeaderCell>
                  <HeaderCell>หน่วย</HeaderCell>
                  <HeaderCell>Case นำส่ง</HeaderCell>
                  <HeaderCell>Case อนุมัติ</HeaderCell>
                  <HeaderCell>FYP นำส่ง</HeaderCell>
                  <HeaderCell>FYP อนุมัติ</HeaderCell>
                  <HeaderCell>FYC อนุมัติ</HeaderCell>
                  <HeaderCell>AIA Case YTD</HeaderCell>
                  <HeaderCell>AIA FYP YTD</HeaderCell>
                  <HeaderCell>AIA FYC YTD</HeaderCell>
                  <HeaderCell>Approved Months</HeaderCell>
                  <HeaderCell>PA Case</HeaderCell>
                  <HeaderCell>PA FYP</HeaderCell>
                  <HeaderCell>PA FYC</HeaderCell>
                  <HeaderCell>PA Case YTD</HeaderCell>
                  <HeaderCell>PA FYP YTD</HeaderCell>
                  <HeaderCell>PA FYC YTD</HeaderCell>
                </tr>
              </thead>

              <tbody>
                {agentSummary.length === 0 ? (
                  <EmptyRow colSpan={20} />
                ) : (
                  <>
                    {agentSummary.map((row, index) => (
                      <tr
                        key={row.name}
                        style={{ borderTop: "1px solid var(--hairline-soft)" }}
                      >
                        <Cell>{index + 1}</Cell>
                        <Cell>{row.code || "-"}</Cell>
                        <Cell>{row.name}</Cell>
                        <Cell>{row.nickname || "-"}</Cell>
                        <Cell>
                          <UnitTag unit={row.unit} />
                        </Cell>
                        <NumberCell>{row.month.caseSubmitted}</NumberCell>
                        <NumberCell>{row.month.caseApproved}</NumberCell>
                        <NumberCell>{money(row.month.fypSubmitted)}</NumberCell>
                        <NumberCell>{money(row.month.fypApproved)}</NumberCell>
                        <NumberCell strong>{money(row.month.fycApproved)}</NumberCell>
                        <NumberCell>{row.ytd.caseApproved}</NumberCell>
                        <NumberCell>{money(row.ytd.fypApproved)}</NumberCell>
                        <NumberCell>{money(row.ytd.fycApproved)}</NumberCell>
                        <NumberCell>{row.approvedMonths}</NumberCell>
                        <NumberCell>{row.month.paCase}</NumberCell>
                        <NumberCell>{money(row.month.paFyp)}</NumberCell>
                        <NumberCell>{money(row.month.paFyc)}</NumberCell>
                        <NumberCell>{row.ytd.paCase}</NumberCell>
                        <NumberCell>{money(row.ytd.paFyp)}</NumberCell>
                        <NumberCell>{money(row.ytd.paFyc)}</NumberCell>
                      </tr>
                    ))}

                    <tr style={totalRowStyle}>
                      <Cell>รวม</Cell>
                      <Cell />
                      <Cell />
                      <Cell />
                      <Cell />
                      <NumberCell>{totals.month.caseSubmitted}</NumberCell>
                      <NumberCell>{totals.month.caseApproved}</NumberCell>
                      <NumberCell>{money(totals.month.fypSubmitted)}</NumberCell>
                      <NumberCell>{money(totals.month.fypApproved)}</NumberCell>
                      <NumberCell>{money(totals.month.fycApproved)}</NumberCell>
                      <NumberCell>{totals.ytd.caseApproved}</NumberCell>
                      <NumberCell>{money(totals.ytd.fypApproved)}</NumberCell>
                      <NumberCell>{money(totals.ytd.fycApproved)}</NumberCell>
                      <Cell>-</Cell>
                      <NumberCell>{totals.month.paCase}</NumberCell>
                      <NumberCell>{money(totals.month.paFyp)}</NumberCell>
                      <NumberCell>{money(totals.month.paFyc)}</NumberCell>
                      <NumberCell>{totals.ytd.paCase}</NumberCell>
                      <NumberCell>{money(totals.ytd.paFyp)}</NumberCell>
                      <NumberCell>{money(totals.ytd.paFyc)}</NumberCell>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </TableBox>
        )}

        {/* ---------------- 🩷 รายหน่วย ---------------- */}
        {view === "unit" && (
          <TableBox
            title={`รายงานผลผลิต หน่วย ${selectedUnit} ปี ${thaiYear}`}
            hint={`มกราคม – ${monthLabel} · YTD สะสมให้อัตโนมัติ`}
          >
            <UnitTable firstColumn="เดือน" lines={unitMonthly} />
          </TableBox>
        )}

        {/* ---------------- 🟢 อันดับเครือ ---------------- */}
        {view === "rank" && (
          <TableBox
            title={`รายงานผลผลิต เครือ Royal Partner ${monthLabel} ${thaiYear}`}
            hint="จัดอันดับหน่วยตาม FYC อนุมัติของเดือนนี้"
          >
            <UnitTable firstColumn="หน่วย" lines={unitRanking} ranked />
          </TableBox>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* COMPONENTS                                                          */
/* ------------------------------------------------------------------ */

function UnitTable({
  firstColumn,
  lines,
  ranked = false,
}: {
  firstColumn: string;
  lines: UnitLine[];
  ranked?: boolean;
}) {
  const sum = lines.reduce(
    (acc, l) => ({
      month: addTotals(acc.month, l.month),
      active: acc.active + l.activeAgents,
    }),
    { month: { ...EMPTY }, active: 0 }
  );

  return (
    <table style={{ ...tableStyle, minWidth: 1100 }}>
      <thead>
        <tr style={{ background: "var(--rp-soft-gold)" }}>
          {ranked && <HeaderCell>อันดับ</HeaderCell>}
          <HeaderCell>{firstColumn}</HeaderCell>
          <HeaderCell>Cases</HeaderCell>
          <HeaderCell>FYP</HeaderCell>
          <HeaderCell>FYC</HeaderCell>
          <HeaderCell>Cases YTD</HeaderCell>
          <HeaderCell>FYP YTD</HeaderCell>
          <HeaderCell>FYC YTD</HeaderCell>
          <HeaderCell>Active Agent</HeaderCell>
        </tr>
      </thead>

      <tbody>
        {lines.length === 0 ? (
          <EmptyRow colSpan={ranked ? 9 : 8} />
        ) : (
          <>
            {lines.map((line, index) => (
              <tr
                key={line.label}
                style={{ borderTop: "1px solid var(--hairline-soft)" }}
              >
                {ranked && (
                  <Cell>
                    <RankBadge rank={index + 1} empty={line.month.fycApproved === 0} />
                  </Cell>
                )}
                <Cell>{line.label}</Cell>
                <NumberCell>{line.month.caseApproved || "-"}</NumberCell>
                <NumberCell>
                  {line.month.fypApproved ? money(line.month.fypApproved) : "-"}
                </NumberCell>
                <NumberCell strong>
                  {line.month.fycApproved ? money(line.month.fycApproved) : "-"}
                </NumberCell>
                <NumberCell>{line.ytd.caseApproved || "-"}</NumberCell>
                <NumberCell>
                  {line.ytd.fypApproved ? money(line.ytd.fypApproved) : "-"}
                </NumberCell>
                <NumberCell>
                  {line.ytd.fycApproved ? money(line.ytd.fycApproved) : "-"}
                </NumberCell>
                <NumberCell>{line.activeAgents || "-"}</NumberCell>
              </tr>
            ))}

            {ranked && (
              <tr style={totalRowStyle}>
                <Cell />
                <Cell>รวมทั้งเครือ</Cell>
                <NumberCell>{sum.month.caseApproved}</NumberCell>
                <NumberCell>{money(sum.month.fypApproved)}</NumberCell>
                <NumberCell>{money(sum.month.fycApproved)}</NumberCell>
                <Cell />
                <Cell />
                <Cell />
                <NumberCell>{sum.active}</NumberCell>
              </tr>
            )}
          </>
        )}
      </tbody>
    </table>
  );
}

function TableBox({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div style={{ fontWeight: 800, color: "var(--cream)", fontSize: 16 }}>
          {title}
        </div>
        <div style={{ color: "var(--cream-faint)", fontSize: 12, marginTop: 4 }}>
          {hint}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: 999,
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        background: active ? "var(--gold)" : "transparent",
        color: active ? "#18120A" : "var(--cream-muted)",
        transition: "background .15s ease, color .15s ease",
      }}
    >
      {children}
    </button>
  );
}

function RankBadge({ rank, empty }: { rank: number; empty: boolean }) {
  const top = !empty && rank <= 3;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 26,
        height: 26,
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 12,
        background: top ? "var(--gold)" : "var(--surface-alt)",
        color: top ? "#18120A" : "var(--cream-muted)",
        border: "1px solid var(--hairline)",
      }}
    >
      {rank}
    </span>
  );
}

function UnitTag({ unit }: { unit: string }) {
  const missing = unit === NO_UNIT;
  return (
    <span
      style={{
        fontSize: 12,
        padding: "3px 8px",
        borderRadius: 999,
        border: `1px solid ${missing ? "var(--rp-danger-border)" : "var(--hairline)"}`,
        color: missing ? "var(--rp-danger)" : "var(--cream-muted)",
      }}
    >
      {unit}
    </span>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          padding: 30,
          textAlign: "center",
          color: "var(--cream-faint)",
        }}
      >
        ยังไม่มี Production ในช่วงเวลาที่เลือก
      </td>
    </tr>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ color: "var(--cream-faint)", fontSize: 12, marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ color: "var(--gold-bright)", fontSize: 21, fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "13px 10px",
        color: "var(--gold-bright)",
        fontSize: 12,
        textAlign: "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Cell({ children }: { children?: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "11px 10px",
        fontSize: 13,
        color: "var(--cream)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function NumberCell({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      style={{
        padding: "11px 10px",
        fontSize: 13,
        color: strong ? "var(--gold-bright)" : "var(--cream)",
        fontWeight: strong ? 800 : 400,
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* STYLES                                                              */
/* ------------------------------------------------------------------ */

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const totalRowStyle = {
  background: "var(--rp-soft-gold)",
  borderTop: "1px solid var(--gold)",
  fontWeight: 800,
};

const filterStyle = {
  background: "var(--surface-alt)",
  color: "var(--cream)",
  border: "1px solid var(--hairline)",
  borderRadius: 9,
  padding: "10px 12px",
  fontSize: 14,
  cursor: "pointer",
};
