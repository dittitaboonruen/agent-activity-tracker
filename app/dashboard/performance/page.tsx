"use client";

import { useEffect, useMemo, useState } from "react";
import HomeButton from "@/components/HomeButton";

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

type AnnualTarget = {
  agent_name: string;
  target_year: number;
  target_fyp: number;
  target_fyc: number;
  target_case: number;
};

type AgentSummary = {
  code: string;
  name: string;
  nickname: string;

  monthlyAiaCaseSubmitted: number;
  monthlyAiaCaseApproved: number;
  monthlyAiaFypSubmitted: number;
  monthlyAiaFypApproved: number;
  monthlyAiaFycApproved: number;

  ytdAiaCaseApproved: number;
  ytdAiaFypApproved: number;
  ytdAiaFycApproved: number;

  monthlyPaCase: number;
  monthlyPaFyp: number;
  monthlyPaFyc: number;

  ytdPaCase: number;
  ytdPaFyp: number;
  ytdPaFyc: number;

  approvedMonths: number;

  targetFyp: number;
  targetFyc: number;
  targetCase: number;
};

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
    maximumFractionDigits: 2,
  });
}

function percent(actual: number, target: number) {
  if (!target) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

export default function PerformanceDashboardPage() {
  const initial = currentBangkokYearMonth();

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  const [rows, setRows] = useState<DailyProduction[]>([]);
  const [targets, setTargets] = useState<AnnualTarget[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [productionResponse, targetResponse] = await Promise.all([
        fetch("/api/daily-production", {
          cache: "no-store",
        }),
        fetch(`/api/annual-target?year=${year}`, {
          cache: "no-store",
        }),
      ]);

      const productionData = await productionResponse.json();
      const targetData = await targetResponse.json();

      if (!productionResponse.ok) {
        setError(
          productionData.error ||
            "ไม่สามารถโหลดข้อมูล Production ได้"
        );
        return;
      }

      if (!targetResponse.ok) {
        setError(
          targetData.error ||
            "ไม่สามารถโหลด Annual Target ได้"
        );
        return;
      }

      setRows(productionData.rows ?? []);
      setTargets(targetData.targets ?? []);
    } catch {
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [year]);

  const summary = useMemo(() => {
    const selectedMonth = `${year}-${month}`;
    const ytdStart = `${year}-01-01`;
    const ytdEnd = `${year}-${month}-31`;

    const monthRows = rows.filter((row) =>
      row.production_date.startsWith(selectedMonth)
    );

    const ytdRows = rows.filter(
      (row) =>
        row.production_date >= ytdStart &&
        row.production_date <= ytdEnd
    );

    const allNames = Array.from(
      new Set([
        ...ytdRows.map((row) => row.agent_name),
        ...targets.map((target) => target.agent_name),
      ])
    )
      .filter(Boolean)
      .sort();

    return allNames.map((agentName): AgentSummary => {
      const monthly = monthRows.filter(
        (row) => row.agent_name === agentName
      );

      const ytd = ytdRows.filter(
        (row) => row.agent_name === agentName
      );

      const latestInfo =
        [...ytd].sort((a, b) =>
          b.production_date.localeCompare(a.production_date)
        )[0] ?? null;

      const target =
        targets.find(
          (item) => item.agent_name === agentName
        ) ?? null;

      const approvedMonthSet = new Set(
        ytd
          .filter(
            (row) =>
              Number(row.aia_case_approved ?? 0) > 0
          )
          .map((row) => row.production_date.slice(0, 7))
      );

      return {
        code: latestInfo?.agent_code ?? "",
        name: agentName,
        nickname: latestInfo?.agent_nickname ?? "",

        monthlyAiaCaseSubmitted: monthly.reduce(
          (sum, row) =>
            sum + Number(row.aia_case_submitted ?? 0),
          0
        ),

        monthlyAiaCaseApproved: monthly.reduce(
          (sum, row) =>
            sum + Number(row.aia_case_approved ?? 0),
          0
        ),

        monthlyAiaFypSubmitted: monthly.reduce(
          (sum, row) =>
            sum + Number(row.aia_fyp_submitted ?? 0),
          0
        ),

        monthlyAiaFypApproved: monthly.reduce(
          (sum, row) =>
            sum + Number(row.aia_fyp_approved ?? 0),
          0
        ),

        monthlyAiaFycApproved: monthly.reduce(
          (sum, row) =>
            sum + Number(row.aia_fyc_approved ?? 0),
          0
        ),

        ytdAiaCaseApproved: ytd.reduce(
          (sum, row) =>
            sum + Number(row.aia_case_approved ?? 0),
          0
        ),

        ytdAiaFypApproved: ytd.reduce(
          (sum, row) =>
            sum + Number(row.aia_fyp_approved ?? 0),
          0
        ),

        ytdAiaFycApproved: ytd.reduce(
          (sum, row) =>
            sum + Number(row.aia_fyc_approved ?? 0),
          0
        ),

        monthlyPaCase: monthly.reduce(
          (sum, row) => sum + Number(row.pa_case ?? 0),
          0
        ),

        monthlyPaFyp: monthly.reduce(
          (sum, row) => sum + Number(row.pa_fyp ?? 0),
          0
        ),

        monthlyPaFyc: monthly.reduce(
          (sum, row) => sum + Number(row.pa_fyc ?? 0),
          0
        ),

        ytdPaCase: ytd.reduce(
          (sum, row) => sum + Number(row.pa_case ?? 0),
          0
        ),

        ytdPaFyp: ytd.reduce(
          (sum, row) => sum + Number(row.pa_fyp ?? 0),
          0
        ),

        ytdPaFyc: ytd.reduce(
          (sum, row) => sum + Number(row.pa_fyc ?? 0),
          0
        ),

        approvedMonths: approvedMonthSet.size,

        targetFyp: Number(target?.target_fyp ?? 0),
        targetFyc: Number(target?.target_fyc ?? 0),
        targetCase: Number(target?.target_case ?? 0),
      };
    });
  }, [rows, targets, year, month]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0D0B08",
        color: "#F4E8D0",
        padding: "26px 18px 60px",
      }}
    >
      <div style={{ maxWidth: 1900, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <HomeButton />
        </div>

        <div style={{ marginBottom: 26 }}>
          <div
            style={{
              color: "#C9A24B",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            ROYAL PARTNER · AGENT DEV
          </div>

          <h1 style={{ fontSize: 34, margin: "8px 0" }}>
            Monthly Performance
          </h1>

          <div style={{ color: "#A89B86" }}>
            Production · YTD · Annual Target
          </div>
        </div>

        {/* FILTER */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 22,
          }}
        >
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={filterStyle}
          >
            {[
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
            ].map(([value, label]) => (
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
            {["2025", "2026", "2027", "2028", "2029", "2030"].map(
              (value) => (
                <option key={value} value={value}>
                  {Number(value) + 543}
                </option>
              )
            )}
          </select>

          <button onClick={loadData} style={filterStyle}>
            ↻ รีเฟรช
          </button>
        </div>

        {loading && (
          <div style={{ marginBottom: 16 }}>
            กำลังโหลดข้อมูล...
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 16, color: "#E0A98B" }}>
            {error}
          </div>
        )}

        {/* TARGET VS ACTUAL */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(300px,1fr))",
            gap: 14,
            marginBottom: 26,
          }}
        >
          {summary.map((row) => (
            <div
              key={row.name}
              style={{
                background: "#17130E",
                border: "1px solid #4A3B1E",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div
                style={{
                  color: "#C9A24B",
                  fontWeight: 800,
                  fontSize: 17,
                }}
              >
                {row.nickname || row.name}
              </div>

              <div
                style={{
                  color: "#8F8370",
                  fontSize: 12,
                  marginTop: 4,
                  marginBottom: 18,
                }}
              >
                {row.name}
              </div>

              <Progress
                label="FYP"
                actual={row.ytdAiaFypApproved}
                target={row.targetFyp}
              />

              <Progress
                label="FYC"
                actual={row.ytdAiaFycApproved}
                target={row.targetFyc}
              />

              <Progress
                label="CASE"
                actual={row.ytdAiaCaseApproved}
                target={row.targetCase}
              />

              <div
                style={{
                  marginTop: 14,
                  fontSize: 13,
                  color: "#A89B86",
                }}
              >
                เดือนที่มีงานอนุมัติ:{" "}
                <strong style={{ color: "#F4E8D0" }}>
                  {row.approvedMonths}
                </strong>{" "}
                เดือน
              </div>
            </div>
          ))}
        </div>

        {/* MONTHLY TABLE */}
        <div
          style={{
            background: "#17130E",
            border: "1px solid #4A3B1E",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 2200,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(201,162,75,.12)",
                  }}
                >
                  <HeaderCell>No.</HeaderCell>
                  <HeaderCell>Code</HeaderCell>
                  <HeaderCell>Name</HeaderCell>
                  <HeaderCell>Nick Name</HeaderCell>

                  <HeaderCell>Case นำส่ง</HeaderCell>
                  <HeaderCell>Case อนุมัติ</HeaderCell>

                  <HeaderCell>FYP นำส่ง</HeaderCell>
                  <HeaderCell>FYP อนุมัติ</HeaderCell>
                  <HeaderCell>FYC อนุมัติ</HeaderCell>

                  <HeaderCell>Case YTD</HeaderCell>
                  <HeaderCell>FYP YTD</HeaderCell>
                  <HeaderCell>FYC YTD</HeaderCell>

                  <HeaderCell>Target CASE</HeaderCell>
                  <HeaderCell>Target FYP</HeaderCell>
                  <HeaderCell>Target FYC</HeaderCell>

                  <HeaderCell>CASE %</HeaderCell>
                  <HeaderCell>FYP %</HeaderCell>
                  <HeaderCell>FYC %</HeaderCell>

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
                {summary.map((row, index) => (
                  <tr
                    key={row.name}
                    style={{
                      borderTop: "1px solid #332A1C",
                    }}
                  >
                    <Cell>{index + 1}</Cell>
                    <Cell>{row.code}</Cell>
                    <Cell>{row.name}</Cell>
                    <Cell>{row.nickname}</Cell>

                    <NumberCell>
                      {row.monthlyAiaCaseSubmitted}
                    </NumberCell>

                    <NumberCell>
                      {row.monthlyAiaCaseApproved}
                    </NumberCell>

                    <NumberCell>
                      {money(row.monthlyAiaFypSubmitted)}
                    </NumberCell>

                    <NumberCell>
                      {money(row.monthlyAiaFypApproved)}
                    </NumberCell>

                    <NumberCell>
                      {money(row.monthlyAiaFycApproved)}
                    </NumberCell>

                    <NumberCell>
                      {row.ytdAiaCaseApproved}
                    </NumberCell>

                    <NumberCell>
                      {money(row.ytdAiaFypApproved)}
                    </NumberCell>

                    <NumberCell>
                      {money(row.ytdAiaFycApproved)}
                    </NumberCell>

                    <NumberCell>{row.targetCase}</NumberCell>

                    <NumberCell>
                      {money(row.targetFyp)}
                    </NumberCell>

                    <NumberCell>
                      {money(row.targetFyc)}
                    </NumberCell>

                    <NumberCell>
                      {percent(
                        row.ytdAiaCaseApproved,
                        row.targetCase
                      )}
                      %
                    </NumberCell>

                    <NumberCell>
                      {percent(
                        row.ytdAiaFypApproved,
                        row.targetFyp
                      )}
                      %
                    </NumberCell>

                    <NumberCell>
                      {percent(
                        row.ytdAiaFycApproved,
                        row.targetFyc
                      )}
                      %
                    </NumberCell>

                    <NumberCell>
                      {row.approvedMonths}
                    </NumberCell>

                    <NumberCell>{row.monthlyPaCase}</NumberCell>
                    <NumberCell>
                      {money(row.monthlyPaFyp)}
                    </NumberCell>
                    <NumberCell>
                      {money(row.monthlyPaFyc)}
                    </NumberCell>

                    <NumberCell>{row.ytdPaCase}</NumberCell>
                    <NumberCell>
                      {money(row.ytdPaFyp)}
                    </NumberCell>
                    <NumberCell>
                      {money(row.ytdPaFyc)}
                    </NumberCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function Progress({
  label,
  actual,
  target,
}: {
  label: string;
  actual: number;
  target: number;
}) {
  const progress = percent(actual, target);
  const width = Math.min(progress, 100);

  return (
    <div style={{ marginBottom: 15 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 13,
          marginBottom: 6,
        }}
      >
        <span>{label}</span>

        <span>
          {money(actual)} / {money(target)} ·{" "}
          <strong style={{ color: "#C9A24B" }}>
            {progress}%
          </strong>
        </span>
      </div>

      <div
        style={{
          height: 7,
          borderRadius: 99,
          background: "#2C251B",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            background: "#C9A24B",
          }}
        />
      </div>
    </div>
  );
}

function HeaderCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th
      style={{
        padding: "13px 10px",
        color: "#D8B66A",
        fontSize: 12,
        textAlign: "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Cell({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: "11px 10px",
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function NumberCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: "11px 10px",
        fontSize: 13,
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

const filterStyle = {
  background: "#17130E",
  color: "#F4E8D0",
  border: "1px solid #4A3B1E",
  borderRadius: 9,
  padding: "10px 12px",
  fontSize: 14,
  cursor: "pointer",
};
